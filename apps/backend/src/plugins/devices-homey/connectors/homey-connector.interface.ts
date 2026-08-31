import { HomeyDevice } from '../models/homey-device.model';
import { HomeySystemInfo } from '../models/homey-system-info.model';
import { HomeyZone } from '../models/homey-zone.model';

import { HomeyEventListener, HomeyUnsubscribe } from './homey-connector.types';

/**
 * Transport-neutral boundary for Homey connector implementations.
 * Connect/disconnect and returned cleanup callbacks must be idempotent.
 */
export interface HomeyConnector {
	/** Resolves only after transport and authentication are usable. */
	connect(): Promise<void>;
	/** Releases transport, subscriptions, timers, listeners, and reconnect work. */
	disconnect(): Promise<void>;
	/** Returns a detached plain-data snapshot. */
	getSystemInfo(): Promise<HomeySystemInfo>;
	/** Returns detached zones in source order. */
	getZones(): Promise<readonly HomeyZone[]>;
	/** Returns detached devices and capabilities in source order. */
	getDevices(): Promise<readonly HomeyDevice[]>;
	/** Returns null only for an authoritative not-found result. */
	getDevice(deviceId: string): Promise<HomeyDevice | null>;
	/** Forwards the full capability ID and resolves once Homey accepts the request. */
	setCapabilityValue(deviceId: string, capabilityId: string, value: unknown): Promise<void>;
	/** Resolves once the upstream subscription is active. */
	subscribe(listener: HomeyEventListener): Promise<HomeyUnsubscribe>;
}
