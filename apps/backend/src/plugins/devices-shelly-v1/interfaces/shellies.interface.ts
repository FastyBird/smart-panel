import EventEmitter from 'events';

/**
 * Type definitions for the shellies library
 * The shellies package is a CommonJS module without TypeScript support
 */

export interface ShellyDevice extends EventEmitter {
	id: string;
	type: string;
	host: string;
	online: boolean;

	// Device properties (varies by device type)
	[key: string]: any;

	// Methods
	setRelay?(index: number, value: boolean): Promise<void>;
	setLight?(index: number, value: any): Promise<void>;
	setRoller?(index: number, command: string, position?: number): Promise<void>;
}

export interface ShelliesLibrary extends EventEmitter {
	// Start discovery
	start(): void;

	// Stop discovery and cleanup
	stop(): void;

	// Get device by ID
	getDevice(id: string): ShellyDevice | undefined;

	// Get all devices
	getDevices(): ShellyDevice[];

	// Events emitted:
	// - 'discover' (device: ShellyDevice)
	// - 'add' (device: ShellyDevice) - synonym for discover in Gen 1
	// - 'remove' (device: ShellyDevice)
}

/**
 * Normalized device event data
 * This is the internal format used by the adapter to communicate with the main service
 */
export interface NormalizedDeviceEvent {
	id: string;
	type: string;
	host: string;
	online: boolean;
}

/**
 * Normalized device change event
 */
export interface NormalizedDeviceChangeEvent {
	id: string;
	property: string;
	newValue: string | number | boolean;
	oldValue: string | number | boolean | null;
}

/**
 * Event types emitted by the adapter
 */
export enum ShelliesAdapterEventType {
	DEVICE_DISCOVERED = 'shelly-v1:device:discovered',
	DEVICE_CHANGED = 'shelly-v1:device:changed',
	DEVICE_OFFLINE = 'shelly-v1:device:offline',
	DEVICE_ONLINE = 'shelly-v1:device:online',
	ERROR = 'shelly-v1:error',
}
