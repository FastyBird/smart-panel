import type { Ref } from 'vue';

// ============================================================================
// Z2M Expose Types
// ============================================================================

export interface IZ2mExpose {
	type: string;
	property?: string;
	name?: string;
	access?: number;
	unit?: string;
	valueMin?: number;
	valueMax?: number;
	valueStep?: number;
	values?: string[];
	features?: IZ2mExpose[];
}

// ============================================================================
// Discovered Device
// ============================================================================

export interface IZigbee2mqttDiscoveredDevice {
	id: string; // ieeeAddress
	friendlyName: string;
	type: 'Router' | 'EndDevice';
	modelId: string | null;
	manufacturer: string | null;
	model: string | null;
	description: string | null;
	powerSource: string | null;
	supported: boolean;
	available: boolean;
	adopted: boolean;
	adoptedDeviceId: string | null;
	exposes: IZ2mExpose[];
	suggestedCategory: string | null;
}

// ============================================================================
// Store State
// ============================================================================

export interface IZigbee2mqttDiscoveredDevicesStateSemaphore {
	fetching: {
		items: boolean;
		item: string[];
	};
}

export interface IZigbee2mqttDiscoveredDevicesStoreState {
	data: Ref<Record<string, IZigbee2mqttDiscoveredDevice>>;
	semaphore: Ref<IZigbee2mqttDiscoveredDevicesStateSemaphore>;
	firstLoad: Ref<boolean>;
}

// ============================================================================
// Store Actions
// ============================================================================

export interface IZigbee2mqttDiscoveredDevicesSetActionPayload {
	id: IZigbee2mqttDiscoveredDevice['id'];
	data: Partial<IZigbee2mqttDiscoveredDevice>;
}

export interface IZigbee2mqttDiscoveredDevicesUnsetActionPayload {
	id: IZigbee2mqttDiscoveredDevice['id'];
}

export interface IZigbee2mqttDiscoveredDevicesGetActionPayload {
	id: IZigbee2mqttDiscoveredDevice['id'];
}

export interface IZigbee2mqttDiscoveredDevicesStoreActions {
	firstLoadFinished: () => boolean;
	getting: (id: IZigbee2mqttDiscoveredDevice['id']) => boolean;
	fetching: () => boolean;
	findAll: () => IZigbee2mqttDiscoveredDevice[];
	findById: (id: IZigbee2mqttDiscoveredDevice['id']) => IZigbee2mqttDiscoveredDevice | null;
	set: (payload: IZigbee2mqttDiscoveredDevicesSetActionPayload) => IZigbee2mqttDiscoveredDevice;
	unset: (payload: IZigbee2mqttDiscoveredDevicesUnsetActionPayload) => void;
	get: (payload: IZigbee2mqttDiscoveredDevicesGetActionPayload) => Promise<IZigbee2mqttDiscoveredDevice>;
	fetch: () => Promise<IZigbee2mqttDiscoveredDevice[]>;
}

// ============================================================================
// Store Setup Return Type
// ============================================================================

export type Zigbee2mqttDiscoveredDevicesStoreSetup = IZigbee2mqttDiscoveredDevicesStoreState &
	IZigbee2mqttDiscoveredDevicesStoreActions;
