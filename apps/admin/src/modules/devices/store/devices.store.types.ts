import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	DeviceCreateReqSchema,
	DeviceResSchema,
	DeviceSchema,
	DeviceUpdateReqSchema,
	DevicesAddActionPayloadSchema,
	DevicesAddZoneActionPayloadSchema,
	DevicesBulkRemoveActionPayloadSchema,
	DevicesBulkResultSchema,
	DevicesBulkSetEnabledActionPayloadSchema,
	DevicesEditActionPayloadSchema,
	DevicesFetchActionPayloadSchema,
	DevicesGetActionPayloadSchema,
	DevicesOnEventActionPayloadSchema,
	DevicesRemoveActionPayloadSchema,
	DevicesRemoveZoneActionPayloadSchema,
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

export type IDevicesFetchActionPayload = z.infer<typeof DevicesFetchActionPayloadSchema>;

export type IDevicesAddActionPayload = z.infer<typeof DevicesAddActionPayloadSchema>;

export type IDevicesEditActionPayload = z.infer<typeof DevicesEditActionPayloadSchema>;

export type IDevicesSaveActionPayload = z.infer<typeof DevicesSaveActionPayloadSchema>;

export type IDevicesRemoveActionPayload = z.infer<typeof DevicesRemoveActionPayloadSchema>;

export type IDevicesBulkRemoveActionPayload = z.infer<typeof DevicesBulkRemoveActionPayloadSchema>;

export type IDevicesBulkSetEnabledActionPayload = z.infer<typeof DevicesBulkSetEnabledActionPayloadSchema>;

export type IDevicesBulkResult = z.infer<typeof DevicesBulkResultSchema>;

export type IDevicesAddZoneActionPayload = z.infer<typeof DevicesAddZoneActionPayloadSchema>;

export type IDevicesRemoveZoneActionPayload = z.infer<typeof DevicesRemoveZoneActionPayloadSchema>;

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
	fetch: (payload?: IDevicesFetchActionPayload) => Promise<IDevice[]>;
	add: (payload: IDevicesAddActionPayload) => Promise<IDevice>;
	edit: (payload: IDevicesEditActionPayload) => Promise<IDevice>;
	save: (payload: IDevicesSaveActionPayload) => Promise<IDevice>;
	remove: (payload: IDevicesRemoveActionPayload) => Promise<boolean>;
	bulkRemove: (payload: IDevicesBulkRemoveActionPayload) => Promise<IDevicesBulkResult>;
	bulkSetEnabled: (payload: IDevicesBulkSetEnabledActionPayload) => Promise<IDevicesBulkResult>;
	addZone: (payload: IDevicesAddZoneActionPayload) => Promise<IDevice>;
	removeZone: (payload: IDevicesRemoveZoneActionPayload) => Promise<IDevice>;
	isLoaded: () => boolean;
	refresh: () => Promise<unknown>;
}

export type DevicesStoreSetup = IDevicesStoreState & IDevicesStoreActions;

// BACKEND API
// ===========

export type IDeviceCreateReq = z.infer<typeof DeviceCreateReqSchema>;

export type IDeviceUpdateReq = z.infer<typeof DeviceUpdateReqSchema>;

export type IDeviceRes = z.infer<typeof DeviceResSchema>;

// STORE
export type DevicesStore = Store<string, IDevicesStoreState, object, IDevicesStoreActions>;
