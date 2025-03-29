import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import { type components } from '../../../openapi';

import { type IChannel } from './channels.store.types';
import { ItemIdSchema } from './types';

type ApiCreateChannelControl = components['schemas']['DevicesCreateChannelControl'];
type ApiChannelControl = components['schemas']['DevicesChannelControl'];

// STORE STATE
// ===========

export const ChannelControlSchema = z.object({
	id: ItemIdSchema,
	draft: z.boolean().default(false),
	channel: ItemIdSchema,
	name: z.string().trim().nonempty(),
	createdAt: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
	updatedAt: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date)))
		.optional()
		.nullable()
		.default(null),
});
export type IChannelControl = z.infer<typeof ChannelControlSchema>;

export const ChannelsControlsStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.array(ItemIdSchema).default([]),
		item: z.array(ItemIdSchema),
	}),
	creating: z.array(ItemIdSchema),
	updating: z.array(ItemIdSchema),
	deleting: z.array(ItemIdSchema),
});
export type IChannelsControlsStateSemaphore = z.infer<typeof ChannelsControlsStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export const ChannelsControlsSetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	channelId: ItemIdSchema,
	data: z.object({
		name: z.string().trim().nonempty(),
	}),
});
export type IChannelsControlsSetActionPayload = z.infer<typeof ChannelsControlsSetActionPayloadSchema>;

export const ChannelsControlsUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema.optional(),
	channelId: ItemIdSchema.optional(),
});
export type IChannelsControlsUnsetActionPayload = z.infer<typeof ChannelsControlsUnsetActionPayloadSchema>;

export const ChannelsControlsGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	channelId: ItemIdSchema,
});
export type IChannelsControlsGetActionPayload = z.infer<typeof ChannelsControlsGetActionPayloadSchema>;

export const ChannelsControlsFetchActionPayloadSchema = z.object({
	channelId: ItemIdSchema,
});
export type IChannelsControlsFetchActionPayload = z.infer<typeof ChannelsControlsFetchActionPayloadSchema>;

export const ChannelsControlsAddActionPayloadSchema = z.object({
	id: ItemIdSchema.optional().default(uuid()),
	channelId: ItemIdSchema,
	draft: z.boolean().optional().default(false),
	data: z.object({
		name: z.string().trim().nonempty(),
	}),
});
export type IChannelsControlsAddActionPayload = z.infer<typeof ChannelsControlsAddActionPayloadSchema>;

export const ChannelsControlsSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	channelId: ItemIdSchema,
});
export type IChannelsControlsSaveActionPayload = z.infer<typeof ChannelsControlsSaveActionPayloadSchema>;

export const ChannelsControlsRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	channelId: ItemIdSchema,
});
export type IChannelsControlsRemoveActionPayload = z.infer<typeof ChannelsControlsRemoveActionPayloadSchema>;

// STORE
// =====

export interface IChannelsControlsStoreState {
	data: Ref<{ [key: IChannelControl['id']]: IChannelControl }>;
	semaphore: Ref<IChannelsControlsStateSemaphore>;
	firstLoad: Ref<IChannel['id'][]>;
}

export interface IChannelsControlsStoreActions {
	// Getters
	firstLoadFinished: (channelId: IChannel['id']) => boolean;
	getting: (id: IChannelControl['id']) => boolean;
	fetching: (channelId: IChannel['id']) => boolean;
	findById: (id: IChannelControl['id']) => IChannelControl | null;
	findForChannel: (channelId: IChannel['id']) => IChannelControl[];
	findAll: () => IChannelControl[];
	// Actions
	set: (payload: IChannelsControlsSetActionPayload) => IChannelControl;
	unset: (payload: IChannelsControlsUnsetActionPayload) => void;
	get: (payload: IChannelsControlsGetActionPayload) => Promise<IChannelControl>;
	fetch: (payload: IChannelsControlsFetchActionPayload) => Promise<IChannelControl[]>;
	add: (payload: IChannelsControlsAddActionPayload) => Promise<IChannelControl>;
	save: (payload: IChannelsControlsSaveActionPayload) => Promise<IChannelControl>;
	remove: (payload: IChannelsControlsRemoveActionPayload) => Promise<boolean>;
}

export type ChannelsControlsStoreSetup = IChannelsControlsStoreState & IChannelsControlsStoreActions;

// BACKEND API
// ===========

export const ChannelControlCreateReqSchema: ZodType<ApiCreateChannelControl> = z.object({
	id: z.string().uuid().optional(),
	channel: z.string().uuid(),
	name: z.string().trim().nonempty(),
});
export type IChannelControlCreateReq = z.infer<typeof ChannelControlCreateReqSchema>;

export const ChannelControlResSchema: ZodType<ApiChannelControl> = z.object({
	id: z.string().uuid(),
	channel: z.string().uuid(),
	name: z.string().trim().nonempty(),
	created_at: z.string().date(),
	updated_at: z.string().date().nullable(),
});
export type IChannelControlRes = z.infer<typeof ChannelControlResSchema>;

// STORE
export type ChannelsControlsStore = Store<string, IChannelsControlsStoreState, object, IChannelsControlsStoreActions>;
