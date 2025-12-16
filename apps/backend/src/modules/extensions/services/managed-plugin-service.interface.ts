/**
 * Service state for managed plugin services.
 */
export type ServiceState = 'stopped' | 'starting' | 'started' | 'stopping' | 'error';

/**
 * Interface for plugin services that should be managed by the PluginServiceManagerService.
 *
 * Services implementing this interface will have their lifecycle (start/stop/restart)
 * managed centrally based on plugin enabled/disabled configuration state.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class ShellyV1DiscoveryService implements IManagedPluginService {
 *   readonly pluginName = 'devices-shelly-v1';
 *   readonly serviceId = 'discovery';
 *
 *   async start(): Promise<void> {
 *     // Start discovery logic
 *   }
 *
 *   async stop(): Promise<void> {
 *     // Stop discovery logic
 *   }
 *
 *   getState(): ServiceState {
 *     return this.state;
 *   }
 * }
 * ```
 */
export interface IManagedPluginService {
	/**
	 * Plugin name this service belongs to (e.g., 'devices-shelly-v1').
	 * Must match the plugin type as registered in ConfigService.
	 */
	readonly pluginName: string;

	/**
	 * Unique service identifier within the plugin (e.g., 'discovery', 'sync').
	 * Used to distinguish multiple services within the same plugin.
	 */
	readonly serviceId: string;

	/**
	 * Start the service.
	 * Called by the manager when the plugin is enabled and app bootstraps.
	 *
	 * This method should be idempotent - multiple calls should be safe.
	 * The service should NOT check if the plugin is enabled; that's handled by the manager.
	 */
	start(): Promise<void>;

	/**
	 * Stop the service gracefully.
	 * Called by the manager when the plugin is disabled or app shuts down.
	 *
	 * This method should be idempotent - multiple calls should be safe.
	 */
	stop(): Promise<void>;

	/**
	 * Get the current service state.
	 */
	getState(): ServiceState;

	/**
	 * Optional: Priority for startup ordering.
	 * Lower values start first. Default is 100.
	 */
	getPriority?(): number;

	/**
	 * Optional: Dependencies on other services.
	 * Return an array of service keys in format 'pluginName:serviceId'.
	 * These services will be started before this one.
	 */
	getDependencies?(): string[];

	/**
	 * Optional: Health check for the service.
	 * Return true if the service is healthy and operational.
	 */
	isHealthy?(): Promise<boolean>;

	/**
	 * Optional: Called when plugin configuration changes.
	 * Allows service to react to config changes without full restart.
	 */
	onConfigChanged?(): Promise<void>;
}

/**
 * Internal registration record for managed services.
 */
export interface ServiceRegistration {
	service: IManagedPluginService;
	pluginName: string;
	serviceId: string;
	priority: number;
}

/**
 * Status of a managed service.
 */
export interface ServiceStatus {
	pluginName: string;
	serviceId: string;
	state: ServiceState;
	enabled: boolean;
	healthy?: boolean;
}
