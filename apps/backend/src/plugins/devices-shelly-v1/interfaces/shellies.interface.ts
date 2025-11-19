import EventEmitter from 'events';

/**
 * Type definitions for the shellies library
 * The shellies package is a CommonJS module without TypeScript support
 */

/**
 * Property value types that can be stored on a Shelly device
 */
export type ShellyDevicePropertyValue = string | number | boolean | null | undefined;

/**
 * Options for setting color on RGB/RGBW lights
 */
export interface ShellyColorOptions {
	switch?: boolean;
	red?: number;
	green?: number;
	blue?: number;
	white?: number;
	gain?: number;
}

export interface ShellyDevice extends EventEmitter {
	id: string;
	type: string;
	host: string;
	online: boolean;
	lastSeen?: number; // Timestamp of last communication

	// Device properties (varies by device type)
	// Examples: relay0, relay1, switch, mode, brightness, red, green, blue, etc.
	[key: string]: ShellyDevicePropertyValue | ((...args: unknown[]) => unknown);

	// Methods
	setRelay?(index: number, value: boolean): Promise<void>;
	setColor?(options: ShellyColorOptions): Promise<void>;
	setWhite?(temperatureOrIndex: number, brightnessOrOn?: number | boolean, on?: boolean): Promise<void>;
	setRoller?(index: number, command: string, position?: number): Promise<void>;
	setRollerPosition?(position: number): Promise<void>;
	setRollerState?(command: string): Promise<void>;
	setAuthCredentials?(username: string, password: string): void;
}

export interface ShelliesLibrary extends EventEmitter {
	// Start discovery
	start(networkInterface?: string): void;

	// Stop discovery and cleanup
	stop(): void;

	// Get device by ID
	getDevice(type: string, id: string): ShellyDevice | undefined;

	staleTimeout: number;

	request: {
		timeout: (timeout: number) => void;
	};

	// Events emitted:
	// - 'discover' (device: ShellyDevice)
	// - 'add' (device: ShellyDevice) - synonym for discovery in Gen 1
	// - 'remove' (device: ShellyDevice)
}

/**
 * Registered device in the adapter registry
 */
export interface RegisteredDevice {
	id: string;
	type: string;
	host: string;
	enabled: boolean; // Whether a device is enabled for updates
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
