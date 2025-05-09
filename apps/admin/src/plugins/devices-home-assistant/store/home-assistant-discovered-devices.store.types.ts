import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	HomeAssistantDiscoveredDeviceResSchema,
	HomeAssistantDiscoveredDeviceSchema,
	HomeAssistantDiscoveredDevicesGetActionPayloadSchema,
	HomeAssistantDiscoveredDevicesSetActionPayloadSchema,
	HomeAssistantDiscoveredDevicesStateSemaphoreSchema,
	HomeAssistantDiscoveredDevicesUnsetActionPayloadSchema,
} from './home-assistant-discovered-devices.store.schemas';

// STORE STATE
// ===========

export type IHomeAssistantDiscoveredDevice = z.infer<typeof HomeAssistantDiscoveredDeviceSchema>;

export type IHomeAssistantDiscoveredDevicesStateSemaphore = z.infer<typeof HomeAssistantDiscoveredDevicesStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IHomeAssistantDiscoveredDevicesSetActionPayload = z.infer<typeof HomeAssistantDiscoveredDevicesSetActionPayloadSchema>;

export type IHomeAssistantDiscoveredDevicesUnsetActionPayload = z.infer<typeof HomeAssistantDiscoveredDevicesUnsetActionPayloadSchema>;

export type IHomeAssistantDiscoveredDevicesGetActionPayload = z.infer<typeof HomeAssistantDiscoveredDevicesGetActionPayloadSchema>;

// STORE
// =====

export interface IHomeAssistantDiscoveredDevicesStoreState {
	data: Ref<{ [key: IHomeAssistantDiscoveredDevice['id']]: IHomeAssistantDiscoveredDevice }>;
	semaphore: Ref<IHomeAssistantDiscoveredDevicesStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IHomeAssistantDiscoveredDevicesStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: (id: IHomeAssistantDiscoveredDevice['id']) => boolean;
	fetching: () => boolean;
	findById: (id: IHomeAssistantDiscoveredDevice['id']) => IHomeAssistantDiscoveredDevice | null;
	findAll: () => IHomeAssistantDiscoveredDevice[];
	// Actions
	set: (payload: IHomeAssistantDiscoveredDevicesSetActionPayload) => IHomeAssistantDiscoveredDevice;
	unset: (payload: IHomeAssistantDiscoveredDevicesUnsetActionPayload) => void;
	get: (payload: IHomeAssistantDiscoveredDevicesGetActionPayload) => Promise<IHomeAssistantDiscoveredDevice>;
	fetch: () => Promise<IHomeAssistantDiscoveredDevice[]>;
}

export type HomeAssistantDiscoveredDevicesStoreSetup = IHomeAssistantDiscoveredDevicesStoreState & IHomeAssistantDiscoveredDevicesStoreActions;

// BACKEND API
// ===========

export type IHomeAssistantDiscoveredDeviceRes = z.infer<typeof HomeAssistantDiscoveredDeviceResSchema>;

// STORE
export type HomeAssistantDiscoveredDevicesStore = Store<
	string,
	IHomeAssistantDiscoveredDevicesStoreState,
	object,
	IHomeAssistantDiscoveredDevicesStoreActions
>;
