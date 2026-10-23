import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { getEnvValue } from '../../../common/utils/config.utils';
import { EventType as ConfigModuleEventType } from '../../config/config.constants';
import { ModuleConfigModel, PluginConfigModel } from '../../config/models/config.model';
import { ConfigService } from '../../config/services/config.service';
import { PluginConfigValidatorService } from '../../config/services/plugin-config-validator.service';
import {
	NotificationActionType,
	NotificationKind,
	NotificationSeverity,
} from '../../notifications/notifications.constants';
import { sanitizeErrorMessage } from '../../notifications/notifications.utils';
import { NotificationsService } from '../../notifications/services/notifications.service';
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
const CONFIG_FORCE_STOP_TIMEOUT_MS = 10_000;

interface ReadinessRetryState {
	attempt: number;
	timer: NodeJS.Timeout | null;
}

/** Readonly evidence tied to the original registration and start attempt. */
export interface ManagedRuntimeAdmission {
	isCurrent(): boolean;
}

interface ManagedStartAttempt {
	registration: ServiceRegistration;
	active: boolean;
	invoked: boolean;
	failed: boolean;
	runtime: ManagedRuntimeAdmission;
}

interface PendingServiceStart {
	attempt: ManagedStartAttempt;
	promise: Promise<void>;
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
	private readonly serviceStartPromises = new WeakMap<IManagedExtensionService, PendingServiceStart>();
	private readonly lifecycleOwners = new WeakMap<IManagedExtensionService, ServiceRegistration>();
	private readonly serviceStopPromises = new WeakMap<IManagedExtensionService, Promise<void>>();
	private readonly issueWrites = new Map<string, Promise<void>>();
	private readonly startAttempts = new WeakMap<ServiceRegistration, ManagedStartAttempt>();
	private readonly startContext = new AsyncLocalStorage<ManagedStartAttempt>();
	// Track the registration owning each open issue, replacing detection derived from
	// `lastError` (which stays set across unrelated conditions - e.g. a transient readiness
	// warning - and so cannot tell "already raised" from "not raised yet"). Set by
	// the failure path, cleared by resolveServiceError during recovery or unregister.
	private readonly openIssues = new Map<string, ServiceRegistration>();
	private readonly isCliMode: boolean;

	private startupComplete = false;
	private shutdownInProgress = false;

	constructor(
		private readonly configService: ConfigService,
		private readonly nestConfigService: NestConfigService,
		private readonly pluginConfigValidator: PluginConfigValidatorService,
		private readonly notifications: NotificationsService,
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

		const registration = this.services.get(key);
		this.revokeAdmission(registration);
		this.services.delete(key);
		this.runtimeInfo.delete(key);
		void this.resolveServiceError(registration);
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
		for (const registration of sorted) this.revokeAdmission(registration);

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
		for (const registration of sorted) this.revokeAdmission(registration);

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

		const registrations = Array.from(this.services.values()).filter(
			(registration) =>
				(payload?.type !== 'plugin' && payload?.type !== 'module') ||
				(registration.owner.kind === payload.type && registration.owner.type === payload.source),
		);
		// Close every affected runtime before waiting on any individual service.
		for (const registration of registrations) {
			if (!this.shouldBeRunning(registration)) this.revokeAdmission(registration);
		}
		for (const registration of registrations) {
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

		if (!this.isCurrentRegistration(registration) || registration.service.getState() !== 'stopped') {
			this.logger.warn(`Cannot restart service ${key}: stop did not reach the stopped state`);

			return false;
		}

		await this.startService(registration);

		if (!this.isCurrentRegistration(registration)) return false;

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

		if (currentState !== 'stopped' && currentState !== 'error' && !this.hasRetiredLifecycle(registration)) {
			this.logger.warn(`Cannot start service ${key} from state ${currentState}`);

			return false;
		}

		await this.startService(registration);

		if (!this.isCurrentRegistration(registration) || this.hasRetiredLifecycle(registration)) return false;

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

		this.revokeAdmission(registration);
		this.clearReadinessRetry(key);

		const currentState = registration.service.getState();

		if (currentState !== 'started' && currentState !== 'starting' && currentState !== 'error') {
			this.logger.warn(`Cannot stop service ${key} from state ${currentState}`);

			return false;
		}

		await this.stopService(registration);

		return this.isCurrentRegistration(registration) && registration.service.getState() === 'stopped';
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

	/** Capture at start entry, before the service's own lifecycle queue can wait. */
	captureCurrentStartAdmission(service: IManagedExtensionService): ManagedRuntimeAdmission | null {
		const attempt = this.startContext.getStore();

		return attempt?.active && attempt.registration.service === service && attempt.runtime.isCurrent()
			? attempt.runtime
			: null;
	}

	private isCurrentRegistration(registration: ServiceRegistration): boolean {
		return this.services.get(this.getRegistrationKey(registration)) === registration;
	}

	private hasRetiredLifecycle(registration: ServiceRegistration): boolean {
		const owner = this.lifecycleOwners.get(registration.service);
		return owner !== undefined && owner !== registration;
	}

	private revokeAdmission(registration: ServiceRegistration): void {
		this.startAttempts.delete(registration);
		try {
			registration.service.revokeCurrentAuthority?.();
		} catch (error) {
			this.logger.error(
				`Failed to revoke service authority: ${this.getRegistrationKey(registration)}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	private async startService(registration: ServiceRegistration, requireDesiredState: boolean = true): Promise<void> {
		if (
			!this.isCurrentRegistration(registration) ||
			this.shutdownInProgress ||
			(requireDesiredState && !this.shouldBeRunning(registration))
		)
			return;
		// A queued stop can still report started until the service's own lifecycle lock opens.
		const pendingStop = this.serviceStopPromises.get(registration.service);
		if (pendingStop !== undefined) {
			await pendingStop;
			await this.startService(registration, requireDesiredState);
			return;
		}
		const pending = this.serviceStartPromises.get(registration.service);

		if (pending) {
			const current = this.startAttempts.get(registration) === pending.attempt;
			await pending.promise;
			if (current || !this.isCurrentRegistration(registration) || this.shutdownInProgress) return;
			await this.startService(registration, requireDesiredState);
			return;
		}
		const state = registration.service.getState();
		if (this.hasRetiredLifecycle(registration) && state !== 'stopped') {
			// Completion of start() does not transfer its runtime to a new registration.
			// Force also joins a service already stopping through its own lifecycle queue.
			await this.stopService(registration, true);
			if (registration.service.getState() !== 'stopped') return;
			await this.startService(registration, requireDesiredState);
			return;
		}
		if (state === 'started' || state === 'starting') return;

		const key = this.getRegistrationKey(registration);
		this.clearReadinessRetryTimer(key);
		const attempt: ManagedStartAttempt = {
			registration,
			active: true,
			invoked: false,
			failed: false,
			runtime: Object.freeze({
				isCurrent: () =>
					this.isCurrentRegistration(registration) &&
					this.startAttempts.get(registration) === attempt &&
					!this.shutdownInProgress &&
					!attempt.failed &&
					attempt.invoked &&
					(!requireDesiredState || this.shouldBeRunning(registration)),
			}),
		};
		this.startAttempts.set(registration, attempt);
		// Install single-flight ownership before a validator can reenter the manager.
		const entry: PendingServiceStart = {
			attempt,
			promise: Promise.resolve()
				.then(() => this.startServiceOnce(registration, key, requireDesiredState, attempt))
				.finally(() => {
					attempt.active = false;
					if (this.serviceStartPromises.get(registration.service) === entry)
						this.serviceStartPromises.delete(registration.service);
				}),
		};
		this.serviceStartPromises.set(registration.service, entry);
		await entry.promise;
	}

	private async startServiceOnce(
		registration: ServiceRegistration,
		key: string,
		requireDesiredState: boolean,
		attempt: ManagedStartAttempt,
	): Promise<void> {
		const isCurrent = () =>
			this.isCurrentRegistration(registration) && this.startAttempts.get(registration) === attempt;
		if (!isCurrent()) return;
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
					if (!isCurrent()) return;
					const warning = 'Configuration readiness check is temporarily unavailable';
					createExtensionLogger(registration.owner.type, 'ManagedServiceManagerService').warn(
						`Service ${registration.serviceId} is enabled but not started because its ${warning.toLowerCase()}.`,
					);

					const runtime = this.runtimeInfo.get(key);

					if (runtime) runtime.lastError = warning;
					await this.scheduleReadinessRetry(registration);

					return;
				}

				if (!isCurrent()) return;

				if (!validationResult.valid && validationResult.transient) {
					const warning = 'Configuration readiness check is temporarily unavailable';
					createExtensionLogger(registration.owner.type, 'ManagedServiceManagerService').warn(
						`Service ${registration.serviceId} is enabled but not started because its ${warning.toLowerCase()}.`,
					);

					const runtime = this.runtimeInfo.get(key);

					if (runtime) runtime.lastError = warning;
					await this.scheduleReadinessRetry(registration);

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
		if (!isCurrent()) return;
		if (requireDesiredState && (this.shutdownInProgress || !this.shouldBeRunning(registration))) {
			this.clearReadinessRetry(key);
			return;
		}

		try {
			attempt.invoked = true;
			// Retain ownership beyond the single-flight promise, including partial startup failure.
			this.lifecycleOwners.set(registration.service, registration);
			await this.startContext.run(attempt, () => registration.service.start());
			if (!isCurrent()) return;

			// Update runtime info on successful start
			const runtime = this.runtimeInfo.get(key);

			if (runtime) {
				runtime.lastStartedAt = new Date();
				runtime.startCount += 1;
				runtime.lastError = undefined;
			}
			this.clearReadinessRetry(key);

			this.logger.log(`Service started successfully: ${key}`);

			await this.resolveServiceError(registration);
		} catch (error) {
			attempt.failed = true;
			if (!isCurrent()) return;
			const err = error as Error;

			// Track the error. `openIssues` - not `lastError` - decides whether this is a fresh
			// transition into error: the readiness-retry timer and config-change resyncs can call
			// back in here repeatedly while a service stays broken, and the issue must raise once
			// per transition, not once per tick. `lastError` alone cannot tell "already raised"
			// from "not raised yet" - it is also set by an unrelated transient readiness warning
			// that never raised anything, which must not suppress the raise for a later, genuine
			// failure.
			const runtime = this.runtimeInfo.get(key);
			const enteringError = runtime !== undefined && !this.openIssues.has(key);

			if (runtime) {
				runtime.lastError = err.message;
			}

			this.logger.error(`Failed to start service ${key}: ${err.message}`, err.stack);

			if (enteringError) {
				this.openIssues.set(key, registration);

				await this.raiseServiceError(registration, err.message);
			}
		}
	}

	private async stopService(registration: ServiceRegistration, force: boolean = false): Promise<void> {
		if (!this.isCurrentRegistration(registration)) return;
		this.revokeAdmission(registration);
		const pending = this.serviceStopPromises.get(registration.service);
		if (pending !== undefined) {
			await pending;
			return;
		}
		// Track the original object's stop independently of its registration or start attempt.
		const stopping = Promise.resolve()
			.then(() => this.stopServiceOnce(registration, force))
			.finally(() => {
				if (this.serviceStopPromises.get(registration.service) === stopping)
					this.serviceStopPromises.delete(registration.service);
			});
		this.serviceStopPromises.set(registration.service, stopping);
		await stopping;
	}

	private async stopServiceOnce(registration: ServiceRegistration, force: boolean): Promise<void> {
		const key = this.getRegistrationKey(registration);
		const owner = this.lifecycleOwners.get(registration.service);
		const releaseStoppedOwner = () => {
			if (registration.service.getState() === 'stopped' && this.lifecycleOwners.get(registration.service) === owner) {
				this.lifecycleOwners.delete(registration.service);
			}
		};
		const currentState = registration.service.getState();

		if (currentState === 'stopped' || (!force && currentState === 'stopping')) {
			releaseStoppedOwner();
			return;
		}

		this.logger.log(`Stopping service: ${key}`);

		try {
			await registration.service.stop();
			releaseStoppedOwner();
			if (!this.isCurrentRegistration(registration)) return;

			// Update runtime info on successful stop
			const runtime = this.runtimeInfo.get(key);

			if (runtime) {
				runtime.lastStoppedAt = new Date();
			}

			this.logger.log(`Service stopped successfully: ${key}`);
		} catch (error) {
			if (!this.isCurrentRegistration(registration)) return;
			const err = error as Error;

			// Track the error
			const runtime = this.runtimeInfo.get(key);

			if (runtime) {
				runtime.lastError = err.message;
			}

			this.logger.error(`Failed to stop service ${key}: ${err.message}`, err.stack);
		}
	}

	private async stopServiceForConfig(registration: ServiceRegistration): Promise<void> {
		let timer: NodeJS.Timeout | undefined;

		try {
			// Bound only config synchronization. The original stop stays tracked and joined
			// by lifecycle callers until it actually settles; never invoke an overlapping stop.
			await Promise.race([
				this.stopService(registration, true),
				new Promise<void>((resolve) => {
					timer = setTimeout(() => {
						this.logger.warn(
							`Timeout waiting for forced config stop of ${this.getRegistrationKey(registration)}; ` +
								`service remains '${registration.service.getState()}', stop still pending`,
						);
						resolve();
					}, CONFIG_FORCE_STOP_TIMEOUT_MS);
				}),
			]);
		} finally {
			if (timer !== undefined) clearTimeout(timer);
		}
	}

	private async syncServiceState(registration: ServiceRegistration): Promise<void> {
		if (!this.isCurrentRegistration(registration)) return;
		const key = this.getRegistrationKey(registration);
		let currentState = registration.service.getState();
		const shouldBeRunning = this.shouldBeRunning(registration);

		if (!shouldBeRunning) {
			this.revokeAdmission(registration);
			this.clearReadinessRetry(key);
		}
		if (shouldBeRunning && this.hasRetiredLifecycle(registration)) {
			await this.startService(registration);
			return;
		}
		const attempt = this.startAttempts.get(registration);
		const isCurrent = () =>
			this.isCurrentRegistration(registration) && this.startAttempts.get(registration) === attempt;

		// Handle transitional states by waiting for them to complete
		if (currentState === 'starting' || currentState === 'stopping') {
			const targetState = currentState === 'starting' ? 'started' : 'stopped';

			await this.waitForState(registration, targetState);
			if (!isCurrent()) return;

			currentState = registration.service.getState();
		}

		// If state is still transitional after timeout, force-stop when the service
		// should not be running (e.g., WhatsApp stuck in 'starting' during QR scan
		// while the admin disables the plugin).
		if (!shouldBeRunning && (currentState === 'starting' || currentState === 'stopping')) {
			this.logger.log(`Service ${key} should be stopped while still in '${currentState}', forcing stop`);

			await this.stopServiceForConfig(registration);

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
				if (!isCurrent()) return;

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

	private async scheduleReadinessRetry(registration: ServiceRegistration): Promise<void> {
		const key = this.getRegistrationKey(registration);

		if (this.shutdownInProgress || this.services.get(key) !== registration) return;

		const current = this.readinessRetries.get(key);

		if (current?.timer) return;

		const attempt = (current?.attempt ?? 0) + 1;

		if (attempt > READINESS_RETRY_MAX_ATTEMPTS) {
			this.readinessRetries.delete(key);
			this.logger.warn(`Readiness retries exhausted for service: ${key}`);

			if (!this.openIssues.has(key)) {
				this.openIssues.set(key, registration);

				const runtime = this.runtimeInfo.get(key);

				await this.raiseServiceError(registration, runtime?.lastError ?? 'Readiness retries exhausted');
			}

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

	/**
	 * Raises the generic `service:<kind>:<type>:<serviceId>` issue for a service the manager has
	 * given up trying to run - a start failure or exhausted readiness retries. `source` is the
	 * owning extension, not this module, so `resolveAll(source)` from the owner's own shutdown
	 * clears exactly its own services and nothing else.
	 */
	private async raiseServiceError(registration: ServiceRegistration, lastError: string): Promise<void> {
		const key = this.getRegistrationKey(registration);

		await this.enqueueIssueWrite(key, async () => {
			if (!this.isCurrentRegistration(registration) || this.openIssues.get(key) !== registration) return;
			// notify() contains storage failures; await persistence before any retirement of this key.
			await this.notifications.notify({
				source: registration.owner.type,
				kind: NotificationKind.ISSUE,
				key: `service:${key}`,
				severity: NotificationSeverity.ERROR,
				title: `Service ${registration.serviceId} of ${registration.owner.type} failed`,
				message: sanitizeErrorMessage(lastError),
				actions: [
					{
						type: NotificationActionType.SERVICE,
						label: 'Restart service',
						extension_kind: registration.owner.kind,
						extension_type: registration.owner.type,
						service_id: registration.serviceId,
						operation: 'restart',
						primary: true,
					},
					{
						type: NotificationActionType.LINK,
						label: 'Open services',
						url: `/extensions?tab=services&kind=${registration.owner.kind}`,
					},
				],
			});
		});
	}

	/**
	 * Resolves the issue {@link raiseServiceError} raised, once the service reports `started`.
	 * A no-op when nothing is open for this service, so a plain successful start never issues a
	 * pointless resolve() call. Unlike notify(), resolve() can throw - caught and logged here, at
	 * the manager boundary, so a storage hiccup on the resolve never turns a successful start into
	 * a reported failure.
	 */
	private async resolveServiceError(registration: ServiceRegistration): Promise<void> {
		const key = this.getRegistrationKey(registration);

		if (this.openIssues.get(key) !== registration) {
			// A healthy replacement also waits for an already queued retirement of its predecessor.
			await this.issueWrites.get(key);
			return;
		}
		this.openIssues.delete(key);

		await this.enqueueIssueWrite(key, async () => {
			try {
				await this.notifications.resolve(registration.owner.type, `service:${key}`);
			} catch (error) {
				const err = error as Error;

				this.logger.error(`Failed to resolve the service issue for ${key}: ${err.message}`, err.stack);
			}
		});
	}

	/** Serialize only this manager's writes for a service key, including retired registrations. */
	private async enqueueIssueWrite(key: string, write: () => Promise<void>): Promise<void> {
		const previous = this.issueWrites.get(key) ?? Promise.resolve();
		const pending = previous.catch(() => undefined).then(write);
		this.issueWrites.set(key, pending);
		try {
			await pending;
		} finally {
			if (this.issueWrites.get(key) === pending) this.issueWrites.delete(key);
		}
	}
}
