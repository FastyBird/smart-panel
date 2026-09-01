import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { getEnvValue } from '../../../common/utils/config.utils';
import { EventType as ConfigModuleEventType } from '../../config/config.constants';
import { ModuleConfigModel, PluginConfigModel } from '../../config/models/config.model';
import { ConfigService } from '../../config/services/config.service';
import { PluginConfigValidatorService } from '../../config/services/plugin-config-validator.service';
import { EXTENSIONS_MODULE_NAME } from '../extensions.constants';

import {
	ConfigChangeResult,
	IManagedExtensionService,
	ManagedServiceOwner,
	ManagedServiceOwnerKind,
	ServiceRegistration,
	ServiceRuntimeInfo,
	ServiceState,
	ServiceStatusExtended,
} from './managed-extension-service.interface';

const READINESS_RETRY_INITIAL_DELAY_MS = 15_000;
const READINESS_RETRY_MAX_ATTEMPTS = 3;

interface ReadinessRetryState {
	attempt: number;
	timer: NodeJS.Timeout | null;
}

/**
 * Centralized service manager for extension-owned runtime lifecycle management.
 *
 * This service provides a single source of truth for managing extension-owned services:
 * - Handles desired state based on extension configuration and activation policy
 * - Manages startup ordering and dependencies
 * - Responds to configuration changes
 * - Provides visibility into service states
 *
 * Extensions register their services during `onModuleInit`, and the manager
 * handles all lifecycle operations during `onApplicationBootstrap` and
 * in response to configuration changes.
 *
 * @example
 * ```typescript
 * // In plugin module
 * onModuleInit() {
 *   this.managedServiceManager.register(this.myService);
 * }
 * ```
 */
@Injectable()
export class ManagedServiceManagerService implements OnApplicationBootstrap, OnModuleDestroy {
	private readonly logger = createExtensionLogger(EXTENSIONS_MODULE_NAME, 'ManagedServiceManagerService');

	private readonly services: Map<string, ServiceRegistration> = new Map();
	private readonly runtimeInfo: Map<string, ServiceRuntimeInfo> = new Map();
	private readonly readinessRetries: Map<string, ReadinessRetryState> = new Map();
	private readonly serviceStartPromises: Map<string, Promise<void>> = new Map();
	private readonly isCliMode: boolean;

	private startupComplete = false;
	private shutdownInProgress = false;

	constructor(
		private readonly configService: ConfigService,
		private readonly nestConfigService: NestConfigService,
		private readonly pluginConfigValidator: PluginConfigValidatorService,
	) {
		this.isCliMode = getEnvValue<string>(this.nestConfigService, 'FB_CLI', null) === 'on';
	}

	/**
	 * Register a managed extension service.
	 *
	 * @param service - The managed service
	 */
	register(service: IManagedExtensionService): void {
		const key = this.getServiceKey(service.owner.kind, service.owner.type, service.serviceId);

		if (this.services.has(key)) {
			this.logger.warn(`Service already registered: ${key}`);

			throw new Error(`Service already registered: ${key}`);
		}

		const priority = service.getPriority?.() ?? 100;

		this.services.set(key, {
			service,
			owner: { ...service.owner },
			serviceId: service.serviceId,
			activationPolicy: service.activationPolicy ?? 'owner-enabled',
			priority,
		});

		// Initialize runtime info
		this.runtimeInfo.set(key, {
			startCount: 0,
		});

		this.logger.log(`Registered service: ${key} (priority: ${priority})`);

		// Late registrations follow the same desired-state rules as boot-time registrations.
		if (this.startupComplete && !this.isCliMode) {
			const registration = this.services.get(key);

			if (registration && this.shouldBeRunning(registration)) {
				void this.startService(registration);
			}
		}
	}

	/**
	 * Unregister a managed extension service.
	 *
	 * @param extensionKind - The extension owner kind
	 * @param extensionType - The extension owner type
	 * @param serviceId - The service identifier
	 */
	unregister(extensionKind: ManagedServiceOwnerKind, extensionType: string, serviceId: string): void {
		const key = this.getServiceKey(extensionKind, extensionType, serviceId);

		if (!this.services.has(key)) {
			return;
		}

		this.services.delete(key);
		this.runtimeInfo.delete(key);
		this.clearReadinessRetry(key);

		this.logger.log(`Unregistered service: ${key}`);
	}

	/**
	 * Called by NestJS when application bootstrap is complete.
	 * Starts all services whose activation policy says they should be running.
	 * Services are grouped by dependency levels and each level starts in parallel.
	 */
	async onApplicationBootstrap(): Promise<void> {
		if (this.isCliMode) {
			this.logger.log('CLI mode detected, skipping service startup');
			this.startupComplete = true;

			return;
		}

		this.logger.log(`Starting ${this.services.size} registered services`);

		const levels = this.getServiceLevels();

		for (let level = 0; level < levels.length; level++) {
			const levelServices = levels[level];

			if (levelServices.length === 0) {
				continue;
			}

			this.logger.log(`Starting level ${level} services (${levelServices.length} services)`);

			// Start all services at this level in parallel
			await Promise.all(levelServices.map((registration) => this.startServiceIfDesired(registration)));
		}

		this.startupComplete = true;

		this.logger.log('All services startup complete');
	}

	/**
	 * Stop all running services. Used during factory reset to ensure
	 * managed services are cleaned up before data is wiped.
	 */
	async stopAllServices(): Promise<void> {
		this.shutdownInProgress = true;
		this.clearAllReadinessRetries();

		this.logger.log('Stopping all managed services for factory reset');

		const sorted = this.getSortedServices().reverse();

		for (const registration of sorted) {
			const state = registration.service.getState();

			if (state === 'stopped') continue;

			if (state === 'starting') {
				await this.waitForState(registration, 'started', 5000);
			} else if (state === 'stopping') {
				await this.waitForState(registration, 'stopped', 5000);

				continue;
			}

			await this.stopService(registration);
		}

		this.shutdownInProgress = false;

		this.logger.log('All services stopped for factory reset');
	}

	/**
	 * Called by NestJS when the module is being destroyed.
	 * Stops all running services in reverse priority order.
	 *
	 * Handles all non-stopped states:
	 * - 'started': Normal stop
	 * - 'error': Clean up any partially allocated resources
	 * - 'starting': Wait for completion, then stop
	 * - 'stopping': Wait for completion
	 */
	async onModuleDestroy(): Promise<void> {
		this.shutdownInProgress = true;
		this.clearAllReadinessRetries();

		this.logger.log('Stopping all managed services');

		// Stop in reverse order (highest priority last started, first stopped)
		const sorted = this.getSortedServices().reverse();

		for (const registration of sorted) {
			const state = registration.service.getState();

			// Skip services that are already stopped
			if (state === 'stopped') {
				// Intentionally empty
				continue;
			}

			// Wait for transitional states to complete before stopping
			if (state === 'starting') {
				await this.waitForState(registration, 'started', 5000);
			} else if (state === 'stopping') {
				await this.waitForState(registration, 'stopped', 5000);

				continue; // Already stopping, no need to call stopService again
			}

			// Stop services in 'started' or 'error' states
			await this.stopService(registration);
		}

		this.logger.log('All services stopped');
	}

	/**
	 * Handle configuration updates.
	 * Starts/stops services based on new enabled state.
	 *
	 * When the event identifies a module or plugin, only services belonging
	 * to that extension owner are synchronized.
	 */
	@OnEvent(ConfigModuleEventType.CONFIG_UPDATED)
	async handleConfigUpdated(payload?: { source: string; type: 'plugin' | 'module' | 'section' }): Promise<void> {
		if (this.shutdownInProgress || !this.startupComplete) {
			return;
		}

		for (const registration of this.services.values()) {
			if (
				(payload?.type === 'plugin' || payload?.type === 'module') &&
				(registration.owner.kind !== payload.type || registration.owner.type !== payload.source)
			) {
				continue;
			}

			await this.syncServiceState(registration);
		}
	}

	/**
	 * Get the status of all managed services with runtime information.
	 */
	async getStatus(): Promise<ServiceStatusExtended[]> {
		const statuses: ServiceStatusExtended[] = [];

		for (const [key, registration] of this.services) {
			const config = this.getOwnerConfig(registration.owner);
			const enabled = config?.enabled ?? false;
			const state = registration.service.getState();
			const runtime = this.runtimeInfo.get(key);
			const desiredState = registration.activationPolicy === 'always' || enabled ? 'started' : 'stopped';

			let healthy: boolean | undefined;

			if (registration.service.isHealthy && state === 'started') {
				try {
					healthy = await registration.service.isHealthy();
				} catch {
					healthy = false;
				}
			}

			// Calculate uptime if service is started
			let uptimeMs: number | undefined;

			if (state === 'started' && runtime?.lastStartedAt) {
				uptimeMs = Date.now() - runtime.lastStartedAt.getTime();
			}

			statuses.push({
				extensionKind: registration.owner.kind,
				extensionType: registration.owner.type,
				serviceId: registration.serviceId,
				activationPolicy: registration.activationPolicy,
				state,
				desiredState,
				enabled,
				healthy,
				lastStartedAt: runtime?.lastStartedAt?.toISOString(),
				lastStoppedAt: runtime?.lastStoppedAt?.toISOString(),
				lastError: runtime?.lastError,
				startCount: runtime?.startCount ?? 0,
				uptimeMs,
			});
		}

		return statuses;
	}

	/**
	 * Get status of a specific service with runtime information.
	 */
	async getServiceStatus(
		extensionKind: ManagedServiceOwnerKind,
		extensionType: string,
		serviceId: string,
	): Promise<ServiceStatusExtended | null> {
		const key = this.getServiceKey(extensionKind, extensionType, serviceId);
		const registration = this.services.get(key);

		if (!registration) {
			return null;
		}

		const config = this.getOwnerConfig(registration.owner);
		const enabled = config?.enabled ?? false;
		const runtime = this.runtimeInfo.get(key);
		const state = registration.service.getState();

		// Check health if service implements isHealthy and is started
		let healthy: boolean | undefined;

		if (registration.service.isHealthy && state === 'started') {
			try {
				healthy = await registration.service.isHealthy();
			} catch {
				healthy = false;
			}
		}

		// Calculate uptime if service is started
		let uptimeMs: number | undefined;

		if (state === 'started' && runtime?.lastStartedAt) {
			uptimeMs = Date.now() - runtime.lastStartedAt.getTime();
		}

		return {
			extensionKind,
			extensionType,
			serviceId,
			activationPolicy: registration.activationPolicy,
			state,
			desiredState: registration.activationPolicy === 'always' || enabled ? 'started' : 'stopped',
			enabled,
			healthy,
			lastStartedAt: runtime?.lastStartedAt?.toISOString(),
			lastStoppedAt: runtime?.lastStoppedAt?.toISOString(),
			lastError: runtime?.lastError,
			startCount: runtime?.startCount ?? 0,
			uptimeMs,
		};
	}

	/**
	 * Manually restart a specific service.
	 * Requires the service's desired state to be started.
	 */
	async restartService(
		extensionKind: ManagedServiceOwnerKind,
		extensionType: string,
		serviceId: string,
	): Promise<boolean> {
		const key = this.getServiceKey(extensionKind, extensionType, serviceId);
		const registration = this.services.get(key);

		if (!registration) {
			this.logger.warn(`Service not found: ${key}`);

			return false;
		}

		if (!this.shouldBeRunning(registration)) {
			this.logger.warn(`Cannot restart service whose desired state is stopped: ${key}`);

			return false;
		}

		const currentState = registration.service.getState();

		if (currentState !== 'started' && currentState !== 'error') {
			this.logger.warn(`Cannot restart service ${key} from state ${currentState}`);

			return false;
		}

		await this.stopService(registration);

		if (registration.service.getState() !== 'stopped') {
			this.logger.warn(`Cannot restart service ${key}: stop did not reach the stopped state`);

			return false;
		}

		await this.startService(registration);

		const resultingState = registration.service.getState();

		return resultingState === 'started' || resultingState === 'starting';
	}

	/**
	 * Manually start a specific service.
	 * Owner-enabled services cannot be manually started while their owner is disabled.
	 */
	async startServiceManually(
		extensionKind: ManagedServiceOwnerKind,
		extensionType: string,
		serviceId: string,
	): Promise<boolean> {
		const key = this.getServiceKey(extensionKind, extensionType, serviceId);
		const registration = this.services.get(key);

		if (!registration) {
			this.logger.warn(`Service not found: ${key}`);

			return false;
		}

		if (!this.shouldBeRunning(registration)) {
			this.logger.warn(`Cannot start service whose desired state is stopped: ${key}`);

			return false;
		}

		const currentState = registration.service.getState();

		if (currentState !== 'stopped' && currentState !== 'error') {
			this.logger.warn(`Cannot start service ${key} from state ${currentState}`);

			return false;
		}

		await this.startService(registration);

		const resultingState = registration.service.getState();

		return resultingState === 'started' || resultingState === 'starting';
	}

	/**
	 * Manually stop a specific service.
	 * This allows stopping a service regardless of its desired state.
	 */
	async stopServiceManually(
		extensionKind: ManagedServiceOwnerKind,
		extensionType: string,
		serviceId: string,
	): Promise<boolean> {
		const key = this.getServiceKey(extensionKind, extensionType, serviceId);
		const registration = this.services.get(key);

		if (!registration) {
			this.logger.warn(`Service not found: ${key}`);

			return false;
		}

		this.clearReadinessRetry(key);

		const currentState = registration.service.getState();

		if (currentState !== 'started' && currentState !== 'starting' && currentState !== 'error') {
			this.logger.warn(`Cannot stop service ${key} from state ${currentState}`);

			return false;
		}

		await this.stopService(registration);

		return registration.service.getState() === 'stopped';
	}

	/**
	 * Check if a service is registered.
	 */
	isRegistered(extensionKind: ManagedServiceOwnerKind, extensionType: string, serviceId: string): boolean {
		return this.services.has(this.getServiceKey(extensionKind, extensionType, serviceId));
	}

	/**
	 * Get all registered service keys.
	 */
	getRegisteredServices(): string[] {
		return Array.from(this.services.keys());
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Private helpers
	// ─────────────────────────────────────────────────────────────────────────────

	private getServiceKey(extensionKind: ManagedServiceOwnerKind, extensionType: string, serviceId: string): string {
		return `${extensionKind}:${extensionType}:${serviceId}`;
	}

	private async startServiceIfDesired(registration: ServiceRegistration): Promise<void> {
		if (!this.shouldBeRunning(registration)) {
			return;
		}

		await this.startService(registration);
	}

	private async startService(registration: ServiceRegistration, requireDesiredState: boolean = true): Promise<void> {
		const key = this.getRegistrationKey(registration);
		const pendingStart = this.serviceStartPromises.get(key);

		if (pendingStart !== undefined) {
			await pendingStart;
			return;
		}

		this.clearReadinessRetryTimer(key);

		const startPromise = this.startServiceOnce(registration, key, requireDesiredState).finally(() => {
			if (this.serviceStartPromises.get(key) === startPromise) this.serviceStartPromises.delete(key);
		});
		this.serviceStartPromises.set(key, startPromise);

		await startPromise;
	}

	private async startServiceOnce(
		registration: ServiceRegistration,
		key: string,
		requireDesiredState: boolean,
	): Promise<void> {
		const currentState = registration.service.getState();

		if (currentState === 'started' || currentState === 'starting') {
			return;
		}

		this.logger.log(`Starting service: ${key}`);

		// Plugin validators guard owner-enabled plugin runtimes. Always-active services intentionally
		// remain available while their owner is disabled or still being configured.
		if (
			registration.owner.kind === 'plugin' &&
			registration.activationPolicy === 'owner-enabled' &&
			this.pluginConfigValidator.hasValidator(registration.owner.type)
		) {
			const config = this.getOwnerConfig(registration.owner);

			if (config) {
				let validationResult: Awaited<ReturnType<PluginConfigValidatorService['validate']>>;

				try {
					validationResult = await this.pluginConfigValidator.validate(
						registration.owner.type,
						config as unknown as Record<string, unknown>,
					);
				} catch {
					const warning = 'Configuration readiness check is temporarily unavailable';
					createExtensionLogger(registration.owner.type, 'ManagedServiceManagerService').warn(
						`Service ${registration.serviceId} is enabled but not started because its ${warning.toLowerCase()}.`,
					);

					const runtime = this.runtimeInfo.get(key);

					if (runtime) runtime.lastError = warning;
					this.scheduleReadinessRetry(registration);

					return;
				}

				if (!validationResult.valid && validationResult.transient) {
					const warning = 'Configuration readiness check is temporarily unavailable';
					createExtensionLogger(registration.owner.type, 'ManagedServiceManagerService').warn(
						`Service ${registration.serviceId} is enabled but not started because its ${warning.toLowerCase()}.`,
					);

					const runtime = this.runtimeInfo.get(key);

					if (runtime) runtime.lastError = warning;
					this.scheduleReadinessRetry(registration);

					return;
				}

				if (!validationResult.valid) {
					const errors = (validationResult.errors ?? []).map((e) => e.message).join('; ');

					createExtensionLogger(registration.owner.type, 'ManagedServiceManagerService').warn(
						`Service ${registration.serviceId} is enabled but not started because configuration needs attention — ${errors}. Configure the plugin in the admin UI.`,
					);

					const runtime = this.runtimeInfo.get(key);

					if (runtime) {
						runtime.lastError = `Config validation failed: ${errors}`;
					}
					this.clearReadinessRetry(key);

					return;
				}
			}
		}

		// Readiness validators may perform asynchronous provider or database work. A disable event can
		// complete while that work is pending and observe this service as still stopped, so re-read the
		// user's intent immediately before allocating runtime resources.
		if (requireDesiredState && (this.shutdownInProgress || !this.shouldBeRunning(registration))) {
			this.clearReadinessRetry(key);
			return;
		}

		try {
			await registration.service.start();

			// Update runtime info on successful start
			const runtime = this.runtimeInfo.get(key);

			if (runtime) {
				runtime.lastStartedAt = new Date();
				runtime.startCount += 1;
				runtime.lastError = undefined;
			}
			this.clearReadinessRetry(key);

			this.logger.log(`Service started successfully: ${key}`);
		} catch (error) {
			const err = error as Error;

			// Track the error
			const runtime = this.runtimeInfo.get(key);

			if (runtime) {
				runtime.lastError = err.message;
			}

			this.logger.error(`Failed to start service ${key}: ${err.message}`, err.stack);
		}
	}

	private async stopService(registration: ServiceRegistration): Promise<void> {
		const key = this.getRegistrationKey(registration);
		const currentState = registration.service.getState();

		if (currentState === 'stopped' || currentState === 'stopping') {
			return;
		}

		this.logger.log(`Stopping service: ${key}`);

		try {
			await registration.service.stop();

			// Update runtime info on successful stop
			const runtime = this.runtimeInfo.get(key);

			if (runtime) {
				runtime.lastStoppedAt = new Date();
			}

			this.logger.log(`Service stopped successfully: ${key}`);
		} catch (error) {
			const err = error as Error;

			// Track the error
			const runtime = this.runtimeInfo.get(key);

			if (runtime) {
				runtime.lastError = err.message;
			}

			this.logger.error(`Failed to stop service ${key}: ${err.message}`, err.stack);
		}
	}

	private async syncServiceState(registration: ServiceRegistration): Promise<void> {
		const key = this.getRegistrationKey(registration);
		let currentState = registration.service.getState();
		const shouldBeRunning = this.shouldBeRunning(registration);

		if (!shouldBeRunning) this.clearReadinessRetry(key);

		// Handle transitional states by waiting for them to complete
		if (currentState === 'starting' || currentState === 'stopping') {
			const targetState = currentState === 'starting' ? 'started' : 'stopped';

			await this.waitForState(registration, targetState);

			currentState = registration.service.getState();
		}

		// If state is still transitional after timeout, force-stop when the service
		// should not be running (e.g., WhatsApp stuck in 'starting' during QR scan
		// while the admin disables the plugin).
		if (!shouldBeRunning && (currentState === 'starting' || currentState === 'stopping')) {
			this.logger.log(`Service ${key} should be stopped while still in '${currentState}', forcing stop`);

			// Call stop() directly instead of stopService() because stopService()
			// has a guard that returns early when state is 'stopping'.
			try {
				await registration.service.stop();

				const runtime = this.runtimeInfo.get(key);

				if (runtime) {
					runtime.lastStoppedAt = new Date();
				}

				this.logger.log(`Service force-stopped successfully: ${key}`);
			} catch (error) {
				const err = error as Error;

				const runtime = this.runtimeInfo.get(key);

				if (runtime) {
					runtime.lastError = err.message;
				}

				this.logger.error(`Failed to force-stop service ${key}: ${err.message}`, err.stack);
			}

			return;
		}

		if (shouldBeRunning && currentState === 'stopped') {
			this.logger.log(`Service ${key} should be running, starting it`);

			await this.startService(registration);
		} else if (shouldBeRunning && currentState === 'error') {
			// Service is in error state but should be running - attempt restart
			this.logger.log(`Service ${key} should be running but is in error, restarting it`);

			await this.startService(registration);
		} else if (!shouldBeRunning && currentState === 'started') {
			this.logger.log(`Service ${key} should be stopped, stopping it`);

			await this.stopService(registration);
		} else if (!shouldBeRunning && currentState === 'error') {
			// Service is in error state and should not be running - ensure it's stopped

			// Try to stop cleanly in case there are resources to clean up
			await this.stopService(registration);
		} else if (shouldBeRunning && currentState === 'started' && registration.service.onConfigChanged) {
			// Notify service of config change

			try {
				const result = await registration.service.onConfigChanged();

				// Check if service signals that restart is required
				if (this.isConfigChangeResult(result) && result.restartRequired) {
					this.logger.log(`Service ${key} requires restart after config change`);

					await this.stopService(registration);
					await this.startService(registration);
				}
			} catch (error) {
				const err = error as Error;

				this.logger.error(`Config change handler failed for ${key}: ${err.message}`);
			}
		}
	}

	private scheduleReadinessRetry(registration: ServiceRegistration): void {
		const key = this.getRegistrationKey(registration);

		if (this.shutdownInProgress || this.services.get(key) !== registration) return;

		const current = this.readinessRetries.get(key);

		if (current?.timer) return;

		const attempt = (current?.attempt ?? 0) + 1;

		if (attempt > READINESS_RETRY_MAX_ATTEMPTS) {
			this.readinessRetries.delete(key);
			this.logger.warn(`Readiness retries exhausted for service: ${key}`);
			return;
		}

		const delayMs = READINESS_RETRY_INITIAL_DELAY_MS * 2 ** (attempt - 1);
		const timer = setTimeout(() => {
			const retry = this.readinessRetries.get(key);

			if (!retry || retry.timer !== timer) return;

			retry.timer = null;

			if (this.shutdownInProgress || this.services.get(key) !== registration || !this.shouldBeRunning(registration)) {
				this.clearReadinessRetry(key);
				return;
			}

			void this.startService(registration).catch((error: unknown) => {
				const message = error instanceof Error ? error.message : 'Unknown error';
				this.logger.error(`Readiness retry failed for service ${key}: ${message}`);
			});
		}, delayMs);
		timer.unref();
		this.readinessRetries.set(key, { attempt, timer });

		this.logger.warn(
			`Scheduled readiness retry ${attempt}/${READINESS_RETRY_MAX_ATTEMPTS} for service ${key} in ${delayMs}ms`,
		);
	}

	private clearReadinessRetryTimer(key: string): void {
		const retry = this.readinessRetries.get(key);

		if (!retry?.timer) return;

		clearTimeout(retry.timer);
		retry.timer = null;
	}

	private clearReadinessRetry(key: string): void {
		this.clearReadinessRetryTimer(key);
		this.readinessRetries.delete(key);
	}

	private clearAllReadinessRetries(): void {
		for (const key of this.readinessRetries.keys()) this.clearReadinessRetry(key);
	}

	private waitForState(
		registration: ServiceRegistration,
		targetState: ServiceState,
		timeoutMs: number = 10000,
	): Promise<void> {
		return new Promise((resolve) => {
			const start = Date.now();

			const check = () => {
				const currentState = registration.service.getState();

				// Success: reached target state
				if (currentState === targetState) {
					return resolve();
				}

				// Also resolve if service ended up in error state (don't wait forever)
				if (currentState === 'error') {
					return resolve();
				}

				// Timeout: resolve anyway to avoid blocking forever
				if (Date.now() - start > timeoutMs) {
					this.logger.warn(`Timeout waiting for ${this.getRegistrationKey(registration)} to reach ${targetState}`);

					return resolve();
				}

				setTimeout(check, 50);
			};

			check();
		});
	}

	private getSortedServices(): ServiceRegistration[] {
		const registrations = Array.from(this.services.values());

		// Sort by priority (lower first), then resolve dependencies
		registrations.sort((a, b) => a.priority - b.priority);

		// Simple topological sort for dependencies
		const sorted: ServiceRegistration[] = [];
		const visited = new Set<string>();
		const visiting = new Set<string>();

		const visit = (reg: ServiceRegistration): void => {
			const key = this.getRegistrationKey(reg);

			if (visited.has(key)) {
				return;
			}

			if (visiting.has(key)) {
				this.logger.warn(`Circular dependency detected for ${key}`);

				return;
			}

			visiting.add(key);

			const deps = reg.service.getDependencies?.() ?? [];

			for (const depKey of deps) {
				const depReg = this.services.get(depKey);

				if (depReg) {
					visit(depReg);
				}
			}

			visiting.delete(key);
			visited.add(key);
			sorted.push(reg);
		};

		for (const reg of registrations) {
			visit(reg);
		}

		return sorted;
	}

	/**
	 * Groups services into dependency levels for parallel startup.
	 * Level 0 contains services with no dependencies.
	 * Level N contains services whose dependencies are all in levels < N.
	 * Within each level, services are sorted by priority.
	 */
	private getServiceLevels(): ServiceRegistration[][] {
		const levels: ServiceRegistration[][] = [];
		const serviceLevels = new Map<string, number>();
		const registrations = Array.from(this.services.values());

		// Calculate level for each service based on dependencies
		const calculateLevel = (reg: ServiceRegistration, visiting: Set<string>): number => {
			const key = this.getRegistrationKey(reg);

			// Already calculated
			if (serviceLevels.has(key)) {
				return serviceLevels.get(key);
			}

			// Circular dependency detection
			if (visiting.has(key)) {
				this.logger.warn(`Circular dependency detected for ${key}, treating as level 0`);

				return 0;
			}

			visiting.add(key);

			const deps = reg.service.getDependencies?.() ?? [];
			let maxDepLevel = -1;

			for (const depKey of deps) {
				const depReg = this.services.get(depKey);

				if (depReg) {
					const depLevel = calculateLevel(depReg, visiting);

					maxDepLevel = Math.max(maxDepLevel, depLevel);
				}
			}

			visiting.delete(key);

			const level = maxDepLevel + 1;

			serviceLevels.set(key, level);

			return level;
		};

		// Calculate levels for all services
		for (const reg of registrations) {
			calculateLevel(reg, new Set());
		}

		// Group services by level
		for (const reg of registrations) {
			const key = this.getRegistrationKey(reg);
			const level = serviceLevels.get(key) ?? 0;

			while (levels.length <= level) {
				levels.push([]);
			}

			levels[level].push(reg);
		}

		// Sort each level by priority (lower first)
		for (const level of levels) {
			level.sort((a, b) => a.priority - b.priority);
		}

		return levels;
	}

	private getRegistrationKey(registration: ServiceRegistration): string {
		return this.getServiceKey(registration.owner.kind, registration.owner.type, registration.serviceId);
	}

	private getOwnerConfig(owner: ManagedServiceOwner): ModuleConfigModel | PluginConfigModel | null {
		try {
			return owner.kind === 'module'
				? this.configService.getModuleConfig(owner.type)
				: this.configService.getPluginConfig(owner.type);
		} catch {
			return null;
		}
	}

	private shouldBeRunning(registration: ServiceRegistration): boolean {
		return registration.activationPolicy === 'always' || (this.getOwnerConfig(registration.owner)?.enabled ?? false);
	}

	private isConfigChangeResult(result: void | ConfigChangeResult): result is ConfigChangeResult {
		return result !== undefined && typeof result === 'object' && 'restartRequired' in result;
	}
}
