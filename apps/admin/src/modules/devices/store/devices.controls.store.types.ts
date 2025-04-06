import type { Ref } from 'vue';



import type { Store } from 'pinia';



import { z } from 'zod';



import { DeviceControlCreateReqSchema, DeviceControlResSchema, DeviceControlSchema, DevicesControlsAddActionPayloadSchema, DevicesControlsFetchActionPayloadSchema, DevicesControlsGetActionPayloadSchema, DevicesControlsRemoveActionPayloadSchema, DevicesControlsSaveActionPayloadSchema, DevicesControlsSetActionPayloadSchema, DevicesControlsStateSemaphoreSchema, DevicesControlsUnsetActionPayloadSchema } from './devices.controls.store.schemas';
import { type IDevice } from './devices.store.types';





// STORE STATE
// ===========

export type IDeviceControl = z.infer<typeof DeviceControlSchema>;

export type IDevicesControlsStateSemaphore = z.infer<typeof DevicesControlsStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IDevicesControlsSetActionPayload = z.infer<typeof DevicesControlsSetActionPayloadSchema>;

export type IDevicesControlsUnsetActionPayload = z.infer<typeof DevicesControlsUnsetActionPayloadSchema>;

export type IDevicesControlsGetActionPayload = z.infer<typeof DevicesControlsGetActionPayloadSchema>;

export type IDevicesControlsFetchActionPayload = z.infer<typeof DevicesControlsFetchActionPayloadSchema>;

export type IDevicesControlsAddActionPayload = z.infer<typeof DevicesControlsAddActionPayloadSchema>;

export type IDevicesControlsSaveActionPayload = z.infer<typeof DevicesControlsSaveActionPayloadSchema>;

export type IDevicesControlsRemoveActionPayload = z.infer<typeof DevicesControlsRemoveActionPayloadSchema>;

// STORE
// =====

export interface IDevicesControlsStoreState {
	data: Ref<{ [key: IDeviceControl['id']]: IDeviceControl }>;
	semaphore: Ref<IDevicesControlsStateSemaphore>;
	firstLoad: Ref<IDevice['id'][]>;
}

export interface IDevicesControlsStoreActions {
	// Getters
	firstLoadFinished: (deviceId: IDevice['id']) => boolean;
	getting: (id: IDeviceControl['id']) => boolean;
	fetching: (deviceId: IDevice['id']) => boolean;
	findById: (id: IDeviceControl['id']) => IDeviceControl | null;
	findForDevice: (deviceId: IDevice['id']) => IDeviceControl[];
	findAll: () => IDeviceControl[];
	// Actions
	set: (payload: IDevicesControlsSetActionPayload) => IDeviceControl;
	unset: (payload: IDevicesControlsUnsetActionPayload) => void;
	get: (payload: IDevicesControlsGetActionPayload) => Promise<IDeviceControl>;
	fetch: (payload: IDevicesControlsFetchActionPayload) => Promise<IDeviceControl[]>;
	add: (payload: IDevicesControlsAddActionPayload) => Promise<IDeviceControl>;
	save: (payload: IDevicesControlsSaveActionPayload) => Promise<IDeviceControl>;
	remove: (payload: IDevicesControlsRemoveActionPayload) => Promise<boolean>;
}

export type DevicesControlsStoreSetup = IDevicesControlsStoreState & IDevicesControlsStoreActions;

// BACKEND API
// ===========

export type IDeviceControlCreateReq = z.infer<typeof DeviceControlCreateReqSchema>;

export type IDeviceControlRes = z.infer<typeof DeviceControlResSchema>;

// STORE
export type DevicesControlsStore = Store<string, IDevicesControlsStoreState, object, IDevicesControlsStoreActions>;
