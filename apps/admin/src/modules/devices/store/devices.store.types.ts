import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	DeviceCreateReqSchema,
	DeviceResSchema,
	DeviceSchema,
	DeviceUpdateReqSchema,
	DevicesAddActionPayloadSchema,
	DevicesEditActionPayloadSchema,
	DevicesGetActionPayloadSchema,
	DevicesOnEventActionPayloadSchema,
	DevicesRemoveActionPayloadSchema,
	DevicesSaveActionPayloadSchema,
	DevicesSetActionPayloadSchema,
	DevicesStateSemaphoreSchema,
	DevicesUnsetActionPayloadSchema,
} from './devices.store.schemas';

// STORE STATE
// ===========

export type IDevice = z.infer<typeof DeviceSchema>;

export type IDevicesStateSemaphore = z.infer<typeof DevicesStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IDevicesOnEventActionPayload = z.infer<typeof DevicesOnEventActionPayloadSchema>;

export type IDevicesSetActionPayload = z.infer<typeof DevicesSetActionPayloadSchema>;

export type IDevicesUnsetActionPayload = z.infer<typeof DevicesUnsetActionPayloadSchema>;

export type IDevicesGetActionPayload = z.infer<typeof DevicesGetActionPayloadSchema>;

export type IDevicesAddActionPayload = z.infer<typeof DevicesAddActionPayloadSchema>;

export type IDevicesEditActionPayload = z.infer<typeof DevicesEditActionPayloadSchema>;

export type IDevicesSaveActionPayload = z.infer<typeof DevicesSaveActionPayloadSchema>;

export type IDevicesRemoveActionPayload = z.infer<typeof DevicesRemoveActionPayloadSchema>;

// STORE
// =====

export interface IDevicesStoreState {
	data: Ref<{ [key: IDevice['id']]: IDevice }>;
	semaphore: Ref<IDevicesStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IDevicesStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: (id: IDevice['id']) => boolean;
	fetching: () => boolean;
	findById: (id: IDevice['id']) => IDevice | null;
	findAll: () => IDevice[];
	// Actions
	onEvent: (payload: IDevicesOnEventActionPayload) => IDevice;
	set: (payload: IDevicesSetActionPayload) => IDevice;
	unset: (payload: IDevicesUnsetActionPayload) => void;
	get: (payload: IDevicesGetActionPayload) => Promise<IDevice>;
	fetch: () => Promise<IDevice[]>;
	add: (payload: IDevicesAddActionPayload) => Promise<IDevice>;
	edit: (payload: IDevicesEditActionPayload) => Promise<IDevice>;
	save: (payload: IDevicesSaveActionPayload) => Promise<IDevice>;
	remove: (payload: IDevicesRemoveActionPayload) => Promise<boolean>;
}

export type DevicesStoreSetup = IDevicesStoreState & IDevicesStoreActions;

// BACKEND API
// ===========

export type IDeviceCreateReq = z.infer<typeof DeviceCreateReqSchema>;

export type IDeviceUpdateReq = z.infer<typeof DeviceUpdateReqSchema>;

export type IDeviceRes = z.infer<typeof DeviceResSchema>;

// STORE
export type DevicesStore = Store<string, IDevicesStoreState, object, IDevicesStoreActions>;
