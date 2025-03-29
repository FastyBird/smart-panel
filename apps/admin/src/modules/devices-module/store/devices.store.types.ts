import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import { DevicesDeviceCategory, type components } from '../../../openapi';

import { ChannelCreateReqSchema, ChannelResSchema } from './channels.store.types';
import { DeviceControlCreateReqSchema, DeviceControlResSchema } from './devices.controls.store.types';
import { ItemIdSchema } from './types';

type ApiCreateDevice = components['schemas']['DevicesCreateDevice'];
type ApiUpdateDevice = components['schemas']['DevicesUpdateDevice'];
type ApiDevice = components['schemas']['DevicesDevice'];

// STORE STATE
// ===========

export const DeviceSchema = z.object({
	id: ItemIdSchema,
	draft: z.boolean().default(false),
	type: z.string(),
	category: z.nativeEnum(DevicesDeviceCategory).default(DevicesDeviceCategory.generic),
	name: z.string().trim().nonempty(),
	description: z.string().trim().nullable().default(null),
	createdAt: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
	updatedAt: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date)))
		.optional()
		.nullable()
		.default(null),
});
export type IDevice = z.infer<typeof DeviceSchema>;

export const DevicesStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.boolean().default(false),
		item: z.array(ItemIdSchema),
	}),
	creating: z.array(ItemIdSchema),
	updating: z.array(ItemIdSchema),
	deleting: z.array(ItemIdSchema),
});
export type IDevicesStateSemaphore = z.infer<typeof DevicesStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export const DevicesSetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	data: z
		.object({
			type: z.string(),
			category: z.nativeEnum(DevicesDeviceCategory).default(DevicesDeviceCategory.generic),
			name: z.string().trim().nonempty(),
			description: z
				.string()
				.trim()
				.transform((val) => (val === '' ? null : val))
				.nullable()
				.optional(),
		})
		.passthrough(),
});
export type IDevicesSetActionPayload = z.infer<typeof DevicesSetActionPayloadSchema>;

export const DevicesUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema,
});
export type IDevicesUnsetActionPayload = z.infer<typeof DevicesUnsetActionPayloadSchema>;

export const DevicesGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
});
export type IDevicesGetActionPayload = z.infer<typeof DevicesGetActionPayloadSchema>;

export const DevicesAddActionPayloadSchema = z.object({
	id: ItemIdSchema.optional().default(uuid()),
	draft: z.boolean().optional().default(false),
	data: z
		.object({
			type: z.string(),
			category: z.nativeEnum(DevicesDeviceCategory).default(DevicesDeviceCategory.generic),
			name: z.string().trim().nonempty(),
			description: z
				.string()
				.trim()
				.transform((val) => (val === '' ? null : val))
				.nullable()
				.optional(),
		})
		.passthrough(),
});
export type IDevicesAddActionPayload = z.infer<typeof DevicesAddActionPayloadSchema>;

export const DevicesEditActionPayloadSchema = z.object({
	id: ItemIdSchema,
	data: z
		.object({
			name: z.string().trim().optional(),
			description: z
				.string()
				.trim()
				.transform((val) => (val === '' ? null : val))
				.nullable()
				.optional(),
		})
		.passthrough(),
});
export type IDevicesEditActionPayload = z.infer<typeof DevicesEditActionPayloadSchema>;

export const DevicesSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
});
export type IDevicesSaveActionPayload = z.infer<typeof DevicesSaveActionPayloadSchema>;

export const DevicesRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
});
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

export const DeviceCreateReqSchema: ZodType<ApiCreateDevice> = z.object({
	id: z.string().uuid().optional(),
	type: z.string().trim().nonempty(),
	category: z.nativeEnum(DevicesDeviceCategory),
	name: z.string().trim().nonempty(),
	description: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	controls: z.array(DeviceControlCreateReqSchema).optional(),
	channels: z.array(ChannelCreateReqSchema).optional(),
});
export type IDeviceCreateReq = z.infer<typeof DeviceCreateReqSchema>;

export const DeviceUpdateReqSchema: ZodType<ApiUpdateDevice> = z.object({
	type: z.string().trim().nonempty(),
	name: z.string().trim().nonempty().optional(),
	description: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
});
export type IDeviceUpdateReq = z.infer<typeof DeviceUpdateReqSchema>;

export const DeviceResSchema: ZodType<ApiDevice> = z.object({
	id: z.string().uuid(),
	type: z.string(),
	category: z.nativeEnum(DevicesDeviceCategory),
	name: z.string().trim().nonempty(),
	description: z.string().trim().nullable(),
	created_at: z.string().date(),
	updated_at: z.string().date().nullable(),
	controls: z.array(DeviceControlResSchema),
	channels: z.array(ChannelResSchema),
});
export type IDeviceRes = z.infer<typeof DeviceResSchema>;

// STORE
export type DevicesStore = Store<string, IDevicesStoreState, object, IDevicesStoreActions>;
