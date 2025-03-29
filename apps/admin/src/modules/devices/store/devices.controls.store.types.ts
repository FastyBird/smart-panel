import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import { type components } from '../../../openapi';

import { type IDevice } from './devices.store.types';
import { ItemIdSchema } from './types';

type ApiCreateDeviceControl = components['schemas']['DevicesCreateDeviceControl'];
type ApiDeviceControl = components['schemas']['DevicesDeviceControl'];

// STORE STATE
// ===========

export const DeviceControlSchema = z.object({
	id: ItemIdSchema,
	draft: z.boolean().default(false),
	device: ItemIdSchema,
	name: z.string().trim().nonempty(),
	createdAt: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
	updatedAt: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date)))
		.optional()
		.nullable()
		.default(null),
});
export type IDeviceControl = z.infer<typeof DeviceControlSchema>;

export const DevicesControlsStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.array(ItemIdSchema).default([]),
		item: z.array(ItemIdSchema),
	}),
	creating: z.array(ItemIdSchema),
	updating: z.array(ItemIdSchema),
	deleting: z.array(ItemIdSchema),
});
export type IDevicesControlsStateSemaphore = z.infer<typeof DevicesControlsStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export const DevicesControlsSetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	deviceId: ItemIdSchema,
	data: z.object({
		name: z.string().trim().nonempty(),
	}),
});
export type IDevicesControlsSetActionPayload = z.infer<typeof DevicesControlsSetActionPayloadSchema>;

export const DevicesControlsUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema.optional(),
	deviceId: ItemIdSchema.optional(),
});
export type IDevicesControlsUnsetActionPayload = z.infer<typeof DevicesControlsUnsetActionPayloadSchema>;

export const DevicesControlsGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	deviceId: ItemIdSchema,
});
export type IDevicesControlsGetActionPayload = z.infer<typeof DevicesControlsGetActionPayloadSchema>;

export const DevicesControlsFetchActionPayloadSchema = z.object({
	deviceId: ItemIdSchema,
});
export type IDevicesControlsFetchActionPayload = z.infer<typeof DevicesControlsFetchActionPayloadSchema>;

export const DevicesControlsAddActionPayloadSchema = z.object({
	id: ItemIdSchema.optional().default(uuid()),
	deviceId: ItemIdSchema,
	draft: z.boolean().optional().default(false),
	data: z.object({
		name: z.string().trim().nonempty(),
	}),
});
export type IDevicesControlsAddActionPayload = z.infer<typeof DevicesControlsAddActionPayloadSchema>;

export const DevicesControlsSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	deviceId: ItemIdSchema,
});
export type IDevicesControlsSaveActionPayload = z.infer<typeof DevicesControlsSaveActionPayloadSchema>;

export const DevicesControlsRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	deviceId: ItemIdSchema,
});
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

export const DeviceControlCreateReqSchema: ZodType<ApiCreateDeviceControl> = z.object({
	id: z.string().uuid().optional(),
	device: z.string().uuid(),
	name: z.string().trim().nonempty(),
});
export type IDeviceControlCreateReq = z.infer<typeof DeviceControlCreateReqSchema>;

export const DeviceControlResSchema: ZodType<ApiDeviceControl> = z.object({
	id: z.string().uuid(),
	device: z.string().uuid(),
	name: z.string().trim().nonempty(),
	created_at: z.string().date(),
	updated_at: z.string().date().nullable(),
});
export type IDeviceControlRes = z.infer<typeof DeviceControlResSchema>;

// STORE
export type DevicesControlsStore = Store<string, IDevicesControlsStoreState, object, IDevicesControlsStoreActions>;
