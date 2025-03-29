import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import {
	DevicesChannelPropertyCategory,
	DevicesChannelPropertyData_type,
	DevicesChannelPropertyPermissions,
	type components,
} from '../../../openapi';

import { type IChannel } from './channels.store.types';
import { ItemIdSchema } from './types';

type ApiCreateChannelProperty = components['schemas']['DevicesCreateChannelProperty'];
type ApiUpdateChannelProperty = components['schemas']['DevicesUpdateChannelProperty'];
type ApiChannelProperty = components['schemas']['DevicesChannelProperty'];

// STORE STATE
// ===========

export const ChannelPropertySchema = z.object({
	id: ItemIdSchema,
	draft: z.boolean().default(false),
	channel: ItemIdSchema,
	category: z.nativeEnum(DevicesChannelPropertyCategory).default(DevicesChannelPropertyCategory.generic),
	name: z.string().trim().nullable(),
	permissions: z.array(z.nativeEnum(DevicesChannelPropertyPermissions)),
	dataType: z.nativeEnum(DevicesChannelPropertyData_type),
	unit: z.string().nullable(),
	format: z.array(z.union([z.string(), z.number()])).nullable(),
	invalid: z.union([z.string(), z.number(), z.boolean(), z.null()]),
	step: z.number().nullable(),
	value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
	createdAt: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
	updatedAt: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date)))
		.optional()
		.nullable()
		.default(null),
});
export type IChannelProperty = z.infer<typeof ChannelPropertySchema>;

export const ChannelsPropertiesStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.array(ItemIdSchema).default([]),
		item: z.array(ItemIdSchema),
	}),
	creating: z.array(ItemIdSchema),
	updating: z.array(ItemIdSchema),
	deleting: z.array(ItemIdSchema),
});
export type IChannelsPropertiesStateSemaphore = z.infer<typeof ChannelsPropertiesStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export const ChannelsPropertiesSetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	channelId: ItemIdSchema,
	data: z.object({
		category: z.nativeEnum(DevicesChannelPropertyCategory).default(DevicesChannelPropertyCategory.generic),
		name: z.string().trim().nullable(),
		permissions: z.array(z.nativeEnum(DevicesChannelPropertyPermissions)),
		dataType: z.nativeEnum(DevicesChannelPropertyData_type),
		unit: z.string().nullable(),
		format: z.array(z.union([z.string(), z.number()])).nullable(),
		invalid: z.union([z.string(), z.number(), z.boolean(), z.null()]),
		step: z.number().nullable(),
		value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
	}),
});
export type IChannelsPropertiesSetActionPayload = z.infer<typeof ChannelsPropertiesSetActionPayloadSchema>;

export const ChannelsPropertiesUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema.optional(),
	channelId: ItemIdSchema.optional(),
});
export type IChannelsPropertiesUnsetActionPayload = z.infer<typeof ChannelsPropertiesUnsetActionPayloadSchema>;

export const ChannelsPropertiesGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	channelId: ItemIdSchema,
});
export type IChannelsPropertiesGetActionPayload = z.infer<typeof ChannelsPropertiesGetActionPayloadSchema>;

export const ChannelsPropertiesFetchActionPayloadSchema = z.object({
	channelId: ItemIdSchema,
});
export type IChannelsPropertiesFetchActionPayload = z.infer<typeof ChannelsPropertiesFetchActionPayloadSchema>;

export const ChannelsPropertiesAddActionPayloadSchema = z.object({
	id: ItemIdSchema.optional().default(uuid()),
	channelId: ItemIdSchema,
	draft: z.boolean().optional().default(false),
	data: z.object({
		category: z.nativeEnum(DevicesChannelPropertyCategory).default(DevicesChannelPropertyCategory.generic),
		name: z.string().trim().nullable(),
		permissions: z.array(z.nativeEnum(DevicesChannelPropertyPermissions)),
		dataType: z.nativeEnum(DevicesChannelPropertyData_type),
		unit: z.string().nullable(),
		format: z.array(z.union([z.string(), z.union([z.number(), z.null()])])).nullable(),
		invalid: z.union([z.string(), z.number(), z.boolean(), z.null()]),
		step: z.number().nullable(),
		value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
	}),
});
export type IChannelsPropertiesAddActionPayload = z.infer<typeof ChannelsPropertiesAddActionPayloadSchema>;

export const ChannelsPropertiesEditActionPayloadSchema = z.object({
	id: ItemIdSchema,
	channelId: ItemIdSchema,
	data: z.object({
		category: z.nativeEnum(DevicesChannelPropertyCategory).optional(),
		name: z.string().trim().nullable().optional(),
		unit: z.string().nullable().optional(),
		format: z
			.array(z.union([z.string(), z.union([z.number(), z.null()])]))
			.nullable()
			.optional(),
		invalid: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
		step: z.number().nullable().optional(),
		value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
	}),
});
export type IChannelsPropertiesEditActionPayload = z.infer<typeof ChannelsPropertiesEditActionPayloadSchema>;

export const ChannelsPropertiesSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	channelId: ItemIdSchema,
});
export type IChannelsPropertiesSaveActionPayload = z.infer<typeof ChannelsPropertiesSaveActionPayloadSchema>;

export const ChannelsPropertiesRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	channelId: ItemIdSchema,
});
export type IChannelsPropertiesRemoveActionPayload = z.infer<typeof ChannelsPropertiesRemoveActionPayloadSchema>;

// STORE
// =====

export interface IChannelsPropertiesStoreState {
	data: Ref<{ [key: IChannelProperty['id']]: IChannelProperty }>;
	semaphore: Ref<IChannelsPropertiesStateSemaphore>;
	firstLoad: Ref<IChannel['id'][]>;
}

export interface IChannelsPropertiesStoreActions {
	// Getters
	firstLoadFinished: (channelId: IChannel['id']) => boolean;
	getting: (id: IChannelProperty['id']) => boolean;
	fetching: (channelId: IChannel['id']) => boolean;
	findById: (id: IChannelProperty['id']) => IChannelProperty | null;
	findForChannel: (channelId: IChannel['id']) => IChannelProperty[];
	findAll: () => IChannelProperty[];
	// Actions
	set: (payload: IChannelsPropertiesSetActionPayload) => IChannelProperty;
	unset: (payload: IChannelsPropertiesUnsetActionPayload) => void;
	get: (payload: IChannelsPropertiesGetActionPayload) => Promise<IChannelProperty>;
	fetch: (payload: IChannelsPropertiesFetchActionPayload) => Promise<IChannelProperty[]>;
	add: (payload: IChannelsPropertiesAddActionPayload) => Promise<IChannelProperty>;
	edit: (payload: IChannelsPropertiesEditActionPayload) => Promise<IChannelProperty>;
	save: (payload: IChannelsPropertiesSaveActionPayload) => Promise<IChannelProperty>;
	remove: (payload: IChannelsPropertiesRemoveActionPayload) => Promise<boolean>;
}

export type ChannelsPropertiesStoreSetup = IChannelsPropertiesStoreState & IChannelsPropertiesStoreActions;

// BACKEND API
// ===========

export const ChannelPropertyCreateReqSchema: ZodType<ApiCreateChannelProperty> = z.object({
	id: z.string().uuid().optional(),
	category: z.nativeEnum(DevicesChannelPropertyCategory),
	name: z.string().trim().nullable(),
	permissions: z.array(z.nativeEnum(DevicesChannelPropertyPermissions)),
	data_type: z.nativeEnum(DevicesChannelPropertyData_type),
	unit: z.string().nullable(),
	format: z.array(z.union([z.string(), z.number()])).nullable(),
	invalid: z.union([z.string(), z.number(), z.boolean(), z.null()]),
	step: z.number().nullable(),
	value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});
export type IChannelPropertyCreateReq = z.infer<typeof ChannelPropertyCreateReqSchema>;

export const ChannelPropertyUpdateReqSchema: ZodType<ApiUpdateChannelProperty> = z.object({
	name: z.string().trim().nullable().optional(),
	unit: z.string().nullable().optional(),
	format: z
		.array(z.union([z.string(), z.number()]))
		.nullable()
		.optional(),
	invalid: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
	step: z.number().nullable().optional(),
	value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});
export type IChannelPropertyUpdateReq = z.infer<typeof ChannelPropertyUpdateReqSchema>;

export const ChannelPropertyResSchema: ZodType<ApiChannelProperty> = z.object({
	id: z.string().uuid(),
	channel: z.string().uuid(),
	category: z.nativeEnum(DevicesChannelPropertyCategory),
	name: z.string().trim().nullable(),
	permissions: z.array(z.nativeEnum(DevicesChannelPropertyPermissions)),
	data_type: z.nativeEnum(DevicesChannelPropertyData_type),
	unit: z.string().nullable(),
	format: z.array(z.union([z.string(), z.number()])).nullable(),
	invalid: z.union([z.string(), z.number(), z.boolean(), z.null()]),
	step: z.number().nullable(),
	value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
	created_at: z.string().date(),
	updated_at: z.string().date().nullable(),
});
export type IChannelPropertyRes = z.infer<typeof ChannelPropertyResSchema>;

// STORE
export type ChannelsPropertiesStore = Store<string, IChannelsPropertiesStoreState, object, IChannelsPropertiesStoreActions>;
