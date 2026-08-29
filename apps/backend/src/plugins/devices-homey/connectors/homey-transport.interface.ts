export type HomeyTransportEventType =
	| 'capability'
	| 'device.availability'
	| 'device.create'
	| 'device.delete'
	| 'device.update'
	| 'zone.create'
	| 'zone.delete'
	| 'zone.update';

export interface HomeyTransportEvent {
	readonly type: HomeyTransportEventType;
	readonly payload: unknown;
	/** Required for item-level capability events whose payload does not contain the device ID. */
	readonly deviceId?: string;
}

export type HomeyTransportEventListener = (event: HomeyTransportEvent) => Promise<void> | void;

export type HomeyTransportUnsubscribe = () => Promise<void> | void;

/**
 * Raw transport boundary shared by local and cloud connectors. SDK adapters
 * own wire-specific event attribution and are the only layers allowed to
 * expose unnormalized Homey values to this interface.
 */
export interface HomeyTransport {
	connect(): Promise<void>;
	disconnect(): Promise<void>;
	getSystemInfo(): Promise<unknown>;
	getZones(): Promise<unknown>;
	getDevices(): Promise<unknown>;
	/** Resolves to null only when the device is authoritatively absent. */
	getDevice(deviceId: string): Promise<unknown>;
	setCapabilityValue(deviceId: string, capabilityId: string, value: unknown): Promise<void>;
	subscribe(listener: HomeyTransportEventListener): Promise<HomeyTransportUnsubscribe>;
}
