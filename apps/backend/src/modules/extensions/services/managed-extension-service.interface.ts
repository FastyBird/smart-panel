/**
 * Service state for managed extension services.
 */
export type ServiceState = 'stopped' | 'starting' | 'started' | 'stopping' | 'error';

/**
 * The type of extension that owns a managed service.
 */
export type ManagedServiceOwnerKind = 'module' | 'plugin';

/**
 * Determines whether a managed service follows its owner's enabled state.
 */
export type ManagedServiceActivationPolicy = 'owner-enabled' | 'always';

/**
 * Identifies the module or plugin that owns a managed service.
 */
export interface ManagedServiceOwner {
	kind: ManagedServiceOwnerKind;
	type: string;
}

/**
 * A long-lived backend runtime whose lifecycle is managed centrally.
 */
export interface IManagedExtensionService {
	readonly owner: ManagedServiceOwner;
	readonly serviceId: string;
	readonly activationPolicy?: ManagedServiceActivationPolicy;

	start(): Promise<void>;
	stop(): Promise<void>;
	getState(): ServiceState;
	getPriority?(): number;

	/**
	 * Return service keys in the format `<owner-kind>:<owner-type>:<service-id>`.
	 */
	getDependencies?(): string[];

	isHealthy?(): Promise<boolean>;
	onConfigChanged?(): Promise<void | ConfigChangeResult>;
}

export interface ConfigChangeResult {
	restartRequired: boolean;
}

export interface ServiceRegistration {
	service: IManagedExtensionService;
	owner: ManagedServiceOwner;
	serviceId: string;
	activationPolicy: ManagedServiceActivationPolicy;
	priority: number;
}

export interface ServiceStatus {
	extensionKind: ManagedServiceOwnerKind;
	extensionType: string;
	serviceId: string;
	activationPolicy: ManagedServiceActivationPolicy;
	state: ServiceState;
	desiredState: 'started' | 'stopped';
	enabled: boolean;
	healthy?: boolean;
}

export interface ServiceRuntimeInfo {
	lastStartedAt?: Date;
	lastStoppedAt?: Date;
	lastError?: string;
	startCount: number;
}

export interface ServiceStatusExtended extends ServiceStatus {
	lastStartedAt?: string;
	lastStoppedAt?: string;
	lastError?: string;
	startCount: number;
	uptimeMs?: number;
}
