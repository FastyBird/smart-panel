import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';

import { getEnvValue } from '../../../common/utils/config.utils';
import { EventType as ConfigModuleEventType } from '../../config/config.constants';
import { PluginConfigModel } from '../../config/models/config.model';
import { ConfigService } from '../../config/services/config.service';

import {
	IManagedPluginService,
	ServiceRegistration,
	ServiceRuntimeInfo,
	ServiceStatusExtended,
} from './managed-plugin-service.interface';

/**
 * Centralized service manager for plugin lifecycle management.
 *
 * This service provides a single source of truth for managing plugin services:
 * - Handles enabled/disabled state based on plugin configuration
 * - Manages startup ordering and dependencies
 * - Responds to configuration changes
 * - Provides visibility into service states
 *
 * Plugins register their services during `onModuleInit`, and the manager
 * handles all lifecycle operations during `onApplicationBootstrap` and
 * in response to configuration changes.
 *
 * @example
 * ```typescript
 * // In plugin module
 * onModuleInit() {
 *   this.pluginServiceManager.register(this.myService);
 * }
 * ```
 */
@Injectable()
export class PluginServiceManagerService implements OnApplicationBootstrap, OnModuleDestroy {
	private readonly logger = new Logger(PluginServiceManagerService.name);

	private readonly services: Map<string, ServiceRegistration> = new Map();
	private readonly runtimeInfo: Map<string, ServiceRuntimeInfo> = new Map();
	private readonly isCliMode: boolean;

	private startupComplete = false;
	private shutdownInProgress = false;

	constructor(
		private readonly configService: ConfigService,
		private readonly nestConfigService: NestConfigService,
	) {
		this.isCliMode = getEnvValue<string>(this.nestConfigService, 'FB_CLI', null) === 'on';
	}

	/**
	 * Register a managed plugin service.
	 * Called by plugins during their `onModuleInit` lifecycle hook.
	 *
	 * @param service - The service implementing IManagedPluginService
	 * @throws Error if a service with the same key is already registered
	 */
	register(service: IManagedPluginService): void {
		const key = this.getServiceKey(service.pluginName, service.serviceId);

		if (this.services.has(key)) {
			this.logger.warn(`[REGISTER] Service already registered: ${key}`);

			return;
		}

		const priority = service.getPriority?.() ?? 100;

		this.services.set(key, {
			service,
			pluginName: service.pluginName,
			serviceId: service.serviceId,
			priority,
		});

		// Initialize runtime info
		this.runtimeInfo.set(key, {
			startCount: 0,
		});

		this.logger.log(`[REGISTER] Registered service: ${key} (priority: ${priority})`);

		// If startup already completed and this plugin is enabled, start the service immediately
		if (this.startupComplete && !this.isCliMode) {
			const config = this.getPluginConfig(service.pluginName);

			if (config?.enabled) {
				void this.startService(this.services.get(key));
			}
		}
	}

	/**
	 * Unregister a managed plugin service.
	 * Called when a plugin is being destroyed or no longer needs management.
	 *
	 * @param pluginName - The plugin name
	 * @param serviceId - The service identifier
	 */
	unregister(pluginName: string, serviceId: string): void {
		const key = this.getServiceKey(pluginName, serviceId);

		if (!this.services.has(key)) {
			this.logger.debug(`[UNREGISTER] Service not found: ${key}`);

			return;
		}

		this.services.delete(key);
		this.runtimeInfo.delete(key);

		this.logger.log(`[UNREGISTER] Unregistered service: ${key}`);
	}

	/**
	 * Called by NestJS when application bootstrap is complete.
	 * Starts all services for enabled plugins.
	 */
	async onApplicationBootstrap(): Promise<void> {
		if (this.isCliMode) {
			this.logger.log('[BOOTSTRAP] CLI mode detected, skipping service startup');
			this.startupComplete = true;

			return;
		}

		this.logger.log(`[BOOTSTRAP] Starting ${this.services.size} registered services`);

		const sorted = this.getSortedServices();

		for (const registration of sorted) {
			await this.startServiceIfEnabled(registration);
		}

		this.startupComplete = true;

		this.logger.log('[BOOTSTRAP] All services startup complete');
	}

	/**
	 * Called by NestJS when the module is being destroyed.
	 * Stops all running services in reverse priority order.
	 */
	async onModuleDestroy(): Promise<void> {
		this.shutdownInProgress = true;

		this.logger.log('[SHUTDOWN] Stopping all managed services');

		// Stop in reverse order (highest priority last started, first stopped)
		const sorted = this.getSortedServices().reverse();

		for (const registration of sorted) {
			if (registration.service.getState() === 'started') {
				await this.stopService(registration);
			}
		}

		this.logger.log('[SHUTDOWN] All services stopped');
	}

	/**
	 * Handle configuration updates.
	 * Starts/stops services based on new enabled state.
	 */
	@OnEvent(ConfigModuleEventType.CONFIG_UPDATED)
	async handleConfigUpdated(): Promise<void> {
		if (this.shutdownInProgress || !this.startupComplete) {
			return;
		}

		this.logger.debug('[CONFIG] Configuration updated, syncing service states');

		for (const registration of this.services.values()) {
			await this.syncServiceState(registration);
		}
	}

	/**
	 * Get the status of all managed services with runtime information.
	 */
	async getStatus(): Promise<ServiceStatusExtended[]> {
		const statuses: ServiceStatusExtended[] = [];

		for (const [key, registration] of this.services) {
			const config = this.getPluginConfig(registration.pluginName);
			const state = registration.service.getState();
			const runtime = this.runtimeInfo.get(key);

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
				pluginName: registration.pluginName,
				serviceId: registration.serviceId,
				state,
				enabled: config?.enabled ?? false,
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
	getServiceStatus(pluginName: string, serviceId: string): ServiceStatusExtended | null {
		const key = this.getServiceKey(pluginName, serviceId);
		const registration = this.services.get(key);

		if (!registration) {
			return null;
		}

		const config = this.getPluginConfig(pluginName);
		const runtime = this.runtimeInfo.get(key);
		const state = registration.service.getState();

		// Calculate uptime if service is started
		let uptimeMs: number | undefined;

		if (state === 'started' && runtime?.lastStartedAt) {
			uptimeMs = Date.now() - runtime.lastStartedAt.getTime();
		}

		return {
			pluginName,
			serviceId,
			state,
			enabled: config?.enabled ?? false,
			lastStartedAt: runtime?.lastStartedAt?.toISOString(),
			lastStoppedAt: runtime?.lastStoppedAt?.toISOString(),
			lastError: runtime?.lastError,
			startCount: runtime?.startCount ?? 0,
			uptimeMs,
		};
	}

	/**
	 * Manually restart a specific service.
	 * Requires the plugin to be enabled.
	 */
	async restartService(pluginName: string, serviceId: string): Promise<boolean> {
		const key = this.getServiceKey(pluginName, serviceId);
		const registration = this.services.get(key);

		if (!registration) {
			this.logger.warn(`[RESTART] Service not found: ${key}`);

			return false;
		}

		const config = this.getPluginConfig(pluginName);

		if (!config?.enabled) {
			this.logger.warn(`[RESTART] Cannot restart disabled service: ${key}`);

			return false;
		}

		await this.stopService(registration);
		await this.startService(registration);

		return true;
	}

	/**
	 * Manually start a specific service.
	 * This allows starting a service regardless of plugin enabled state.
	 */
	async startServiceManually(pluginName: string, serviceId: string): Promise<boolean> {
		const key = this.getServiceKey(pluginName, serviceId);
		const registration = this.services.get(key);

		if (!registration) {
			this.logger.warn(`[START_MANUAL] Service not found: ${key}`);

			return false;
		}

		const currentState = registration.service.getState();

		if (currentState === 'started' || currentState === 'starting') {
			this.logger.warn(`[START_MANUAL] Service ${key} is already ${currentState}`);

			return false;
		}

		await this.startService(registration);

		return registration.service.getState() === 'started';
	}

	/**
	 * Manually stop a specific service.
	 * This allows stopping a service regardless of plugin enabled state.
	 */
	async stopServiceManually(pluginName: string, serviceId: string): Promise<boolean> {
		const key = this.getServiceKey(pluginName, serviceId);
		const registration = this.services.get(key);

		if (!registration) {
			this.logger.warn(`[STOP_MANUAL] Service not found: ${key}`);

			return false;
		}

		const currentState = registration.service.getState();

		if (currentState === 'stopped' || currentState === 'stopping') {
			this.logger.warn(`[STOP_MANUAL] Service ${key} is already ${currentState}`);

			return false;
		}

		await this.stopService(registration);

		return registration.service.getState() === 'stopped';
	}

	/**
	 * Check if a service is registered.
	 */
	isRegistered(pluginName: string, serviceId: string): boolean {
		return this.services.has(this.getServiceKey(pluginName, serviceId));
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

	private getServiceKey(pluginName: string, serviceId: string): string {
		return `${pluginName}:${serviceId}`;
	}

	private async startServiceIfEnabled(registration: ServiceRegistration): Promise<void> {
		const config = this.getPluginConfig(registration.pluginName);

		if (!config?.enabled) {
			this.logger.debug(`[START] Plugin ${registration.pluginName} is disabled, skipping ${registration.serviceId}`);

			return;
		}

		await this.startService(registration);
	}

	private async startService(registration: ServiceRegistration): Promise<void> {
		const key = this.getServiceKey(registration.pluginName, registration.serviceId);
		const currentState = registration.service.getState();

		if (currentState === 'started' || currentState === 'starting') {
			this.logger.debug(`[START] Service ${key} is already ${currentState}`);

			return;
		}

		this.logger.log(`[START] Starting service: ${key}`);

		try {
			await registration.service.start();

			// Update runtime info on successful start
			const runtime = this.runtimeInfo.get(key);

			if (runtime) {
				runtime.lastStartedAt = new Date();
				runtime.startCount += 1;
				runtime.lastError = undefined;
			}

			this.logger.log(`[START] Service started successfully: ${key}`);
		} catch (error) {
			const err = error as Error;

			// Track the error
			const runtime = this.runtimeInfo.get(key);

			if (runtime) {
				runtime.lastError = err.message;
			}

			this.logger.error(`[START] Failed to start service ${key}: ${err.message}`, err.stack);
		}
	}

	private async stopService(registration: ServiceRegistration): Promise<void> {
		const key = this.getServiceKey(registration.pluginName, registration.serviceId);
		const currentState = registration.service.getState();

		if (currentState === 'stopped' || currentState === 'stopping') {
			this.logger.debug(`[STOP] Service ${key} is already ${currentState}`);

			return;
		}

		this.logger.log(`[STOP] Stopping service: ${key}`);

		try {
			await registration.service.stop();

			// Update runtime info on successful stop
			const runtime = this.runtimeInfo.get(key);

			if (runtime) {
				runtime.lastStoppedAt = new Date();
			}

			this.logger.log(`[STOP] Service stopped successfully: ${key}`);
		} catch (error) {
			const err = error as Error;

			// Track the error
			const runtime = this.runtimeInfo.get(key);

			if (runtime) {
				runtime.lastError = err.message;
			}

			this.logger.error(`[STOP] Failed to stop service ${key}: ${err.message}`, err.stack);
		}
	}

	private async syncServiceState(registration: ServiceRegistration): Promise<void> {
		const key = this.getServiceKey(registration.pluginName, registration.serviceId);
		const config = this.getPluginConfig(registration.pluginName);
		const currentState = registration.service.getState();
		const shouldBeRunning = config?.enabled ?? false;

		if (shouldBeRunning && currentState === 'stopped') {
			this.logger.log(`[SYNC] Plugin ${registration.pluginName} enabled, starting ${registration.serviceId}`);

			await this.startService(registration);
		} else if (!shouldBeRunning && currentState === 'started') {
			this.logger.log(`[SYNC] Plugin ${registration.pluginName} disabled, stopping ${registration.serviceId}`);

			await this.stopService(registration);
		} else if (shouldBeRunning && currentState === 'started' && registration.service.onConfigChanged) {
			// Notify service of config change without restart
			this.logger.debug(`[SYNC] Notifying ${key} of config change`);

			try {
				await registration.service.onConfigChanged();
			} catch (error) {
				const err = error as Error;

				this.logger.error(`[SYNC] Config change handler failed for ${key}: ${err.message}`);
			}
		}
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
			const key = this.getServiceKey(reg.pluginName, reg.serviceId);

			if (visited.has(key)) {
				return;
			}

			if (visiting.has(key)) {
				this.logger.warn(`[SORT] Circular dependency detected for ${key}`);

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

	private getPluginConfig(pluginName: string): PluginConfigModel | null {
		try {
			return this.configService.getPluginConfig(pluginName);
		} catch {
			return null;
		}
	}
}
