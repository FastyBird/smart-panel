import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import { DevicesChannelCategory, type components } from '../../../openapi';

import { ChannelControlCreateReqSchema, ChannelControlResSchema } from './channels.controls.store.types';
import { ChannelPropertyCreateReqSchema, ChannelPropertyResSchema } from './channels.properties.store.types';
import { type IDevice } from './devices.store.types';
import { ItemIdSchema } from './types';

type ApiCreateChannel = components['schemas']['DevicesCreateChannel'];
type ApiUpdateChannel = components['schemas']['DevicesUpdateChannel'];
type ApiChannel = components['schemas']['DevicesChannel'];

// STORE STATE
// ===========

export const ChannelSchema = z.object({
	id: ItemIdSchema,
	draft: z.boolean().default(false),
	device: ItemIdSchema,
	category: z.nativeEnum(DevicesChannelCategory).default(DevicesChannelCategory.generic),
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
export type IChannel = z.infer<typeof ChannelSchema>;

export const ChannelsStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.array(z.union([ItemIdSchema, z.literal('all')])).default([]),
		item: z.array(ItemIdSchema),
	}),
	creating: z.array(ItemIdSchema),
	updating: z.array(ItemIdSchema),
	deleting: z.array(ItemIdSchema),
});
export type IChannelsStateSemaphore = z.infer<typeof ChannelsStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export const ChannelsSetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	deviceId: ItemIdSchema,
	data: z.object({
		category: z.nativeEnum(DevicesChannelCategory).default(DevicesChannelCategory.generic),
		name: z.string().trim().nonempty(),
		description: z
			.string()
			.trim()
			.transform((val) => (val === '' ? null : val))
			.nullable()
			.optional(),
	}),
});
export type IChannelsSetActionPayload = z.infer<typeof ChannelsSetActionPayloadSchema>;

export const ChannelsUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema.optional(),
	deviceId: ItemIdSchema.optional(),
});
export type IChannelsUnsetActionPayload = z.infer<typeof ChannelsUnsetActionPayloadSchema>;

export const ChannelsGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	deviceId: ItemIdSchema.optional(),
});
export type IChannelsGetActionPayload = z.infer<typeof ChannelsGetActionPayloadSchema>;

export const ChannelsFetchActionPayloadSchema = z.object({
	deviceId: ItemIdSchema.optional(),
});
export type IChannelsFetchActionPayload = z.infer<typeof ChannelsFetchActionPayloadSchema>;

export const ChannelsAddActionPayloadSchema = z.object({
	id: ItemIdSchema.optional().default(uuid()),
	deviceId: ItemIdSchema,
	draft: z.boolean().optional().default(false),
	data: z.object({
		category: z.nativeEnum(DevicesChannelCategory).default(DevicesChannelCategory.generic),
		name: z.string().trim().nonempty(),
		description: z
			.string()
			.trim()
			.transform((val) => (val === '' ? null : val))
			.nullable()
			.optional(),
	}),
});
export type IChannelsAddActionPayload = z.infer<typeof ChannelsAddActionPayloadSchema>;

export const ChannelsEditActionPayloadSchema = z.object({
	id: ItemIdSchema,
	deviceId: ItemIdSchema.optional(),
	data: z.object({
		category: z.nativeEnum(DevicesChannelCategory).optional(),
		name: z.string().trim().optional(),
		description: z
			.string()
			.trim()
			.transform((val) => (val === '' ? null : val))
			.nullable()
			.optional(),
	}),
});
export type IChannelsEditActionPayload = z.infer<typeof ChannelsEditActionPayloadSchema>;

export const ChannelsSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	deviceId: ItemIdSchema,
});
export type IChannelsSaveActionPayload = z.infer<typeof ChannelsSaveActionPayloadSchema>;

export const ChannelsRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	deviceId: ItemIdSchema.optional(),
});
export type IChannelsRemoveActionPayload = z.infer<typeof ChannelsRemoveActionPayloadSchema>;

// STORE
// =====

export interface IChannelsStoreState {
	data: Ref<{ [key: IChannel['id']]: IChannel }>;
	semaphore: Ref<IChannelsStateSemaphore>;
	firstLoad: Ref<(IDevice['id'] | 'all')[]>;
}

export interface IChannelsStoreActions {
	// Getters
	firstLoadFinished: (deviceId?: IDevice['id'] | null) => boolean;
	getting: (id: IChannel['id']) => boolean;
	fetching: (deviceId?: IDevice['id'] | null) => boolean;
	findById: (id: IChannel['id']) => IChannel | null;
	findForDevice: (deviceId: IDevice['id']) => IChannel[];
	findAll: () => IChannel[];
	// Actions
	set: (payload: IChannelsSetActionPayload) => IChannel;
	unset: (payload: IChannelsUnsetActionPayload) => void;
	get: (payload: IChannelsGetActionPayload) => Promise<IChannel>;
	fetch: (payload?: IChannelsFetchActionPayload) => Promise<IChannel[]>;
	add: (payload: IChannelsAddActionPayload) => Promise<IChannel>;
	edit: (payload: IChannelsEditActionPayload) => Promise<IChannel>;
	save: (payload: IChannelsSaveActionPayload) => Promise<IChannel>;
	remove: (payload: IChannelsRemoveActionPayload) => Promise<boolean>;
}

export type ChannelsStoreSetup = IChannelsStoreState & IChannelsStoreActions;

// BACKEND API
// ===========

export const ChannelCreateReqSchema: ZodType<ApiCreateChannel> = z.object({
	id: z.string().uuid().optional(),
	device: z.string().uuid(),
	category: z.nativeEnum(DevicesChannelCategory),
	name: z.string().trim().nonempty(),
	description: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	controls: z.array(ChannelControlCreateReqSchema).optional(),
	properties: z.array(ChannelPropertyCreateReqSchema).optional(),
});
export type IChannelCreateReq = z.infer<typeof ChannelCreateReqSchema>;

export const ChannelUpdateReqSchema: ZodType<ApiUpdateChannel> = z.object({
	name: z.string().trim().nonempty().optional(),
	description: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
});
export type IChannelUpdateReq = z.infer<typeof ChannelUpdateReqSchema>;

export const ChannelResSchema: ZodType<ApiChannel> = z.object({
	id: z.string().uuid(),
	device: z.string().uuid(),
	category: z.nativeEnum(DevicesChannelCategory),
	name: z.string().trim().nonempty(),
	description: z.string().trim().nullable(),
	created_at: z.string().date(),
	updated_at: z.string().date().nullable(),
	controls: z.array(ChannelControlResSchema),
	properties: z.array(ChannelPropertyResSchema),
});
export type IChannelRes = z.infer<typeof ChannelResSchema>;

// STORE
export type ChannelsStore = Store<string, IChannelsStoreState, object, IChannelsStoreActions>;
