import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import { type components } from '../../../openapi';

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

export const ChannelsControlsStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.array(ItemIdSchema).default([]),
		item: z.array(ItemIdSchema),
	}),
	creating: z.array(ItemIdSchema),
	updating: z.array(ItemIdSchema),
	deleting: z.array(ItemIdSchema),
});

// STORE ACTIONS
// =============

export const ChannelsControlsSetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	channelId: ItemIdSchema,
	data: z.object({
		name: z.string().trim().nonempty(),
	}),
});

export const ChannelsControlsUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema.optional(),
	channelId: ItemIdSchema.optional(),
});

export const ChannelsControlsGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	channelId: ItemIdSchema,
});

export const ChannelsControlsFetchActionPayloadSchema = z.object({
	channelId: ItemIdSchema,
});

export const ChannelsControlsAddActionPayloadSchema = z.object({
	id: ItemIdSchema.optional().default(uuid()),
	channelId: ItemIdSchema,
	draft: z.boolean().optional().default(false),
	data: z.object({
		name: z.string().trim().nonempty(),
	}),
});

export const ChannelsControlsSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	channelId: ItemIdSchema,
});

export const ChannelsControlsRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	channelId: ItemIdSchema,
});

// BACKEND API
// ===========

export const ChannelControlCreateReqSchema: ZodType<ApiCreateChannelControl> = z.object({
	id: z.string().uuid().optional(),
	channel: z.string().uuid(),
	name: z.string().trim().nonempty(),
});

export const ChannelControlResSchema: ZodType<ApiChannelControl> = z.object({
	id: z.string().uuid(),
	channel: z.string().uuid(),
	name: z.string().trim().nonempty(),
	created_at: z.string().date(),
	updated_at: z.string().date().nullable(),
});
