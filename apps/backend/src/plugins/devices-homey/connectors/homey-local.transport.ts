export type HomeyLocalTransportEventType =
	| 'capability'
	| 'device.availability'
	| 'device.create'
	| 'device.delete'
	| 'device.update'
	| 'zone.create'
	| 'zone.delete'
	| 'zone.update';

export interface HomeyLocalTransportEvent {
	readonly type: HomeyLocalTransportEventType;
	readonly payload: unknown;
	/** Required for item-level capability events whose payload does not contain the device ID. */
	readonly deviceId?: string;
}

export type HomeyLocalTransportEventListener = (event: HomeyLocalTransportEvent) => Promise<void> | void;

export type HomeyLocalTransportUnsubscribe = () => Promise<void> | void;

/**
 * Local transport boundary. The eventual SDK or direct-protocol adapter owns
 * wire-specific event attribution and is the only layer allowed to expose raw
 * Homey values to this interface.
 */
export interface HomeyLocalTransport {
	connect(): Promise<void>;
	disconnect(): Promise<void>;
	getSystemInfo(): Promise<unknown>;
	getZones(): Promise<unknown>;
	getDevices(): Promise<unknown>;
	/** Resolves to null only when the device is authoritatively absent. */
	getDevice(deviceId: string): Promise<unknown>;
	setCapabilityValue(deviceId: string, capabilityId: string, value: unknown): Promise<void>;
	subscribe(listener: HomeyLocalTransportEventListener): Promise<HomeyLocalTransportUnsubscribe>;
}
