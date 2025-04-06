import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import { DevicesChannelCategory, type components } from '../../../openapi';

import { ChannelControlCreateReqSchema, ChannelControlResSchema } from './channels.controls.store.schemas';
import { ChannelPropertyCreateReqSchema, ChannelPropertyResSchema } from './channels.properties.store.schemas';
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

export const ChannelsStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.array(z.union([ItemIdSchema, z.literal('all')])).default([]),
		item: z.array(ItemIdSchema),
	}),
	creating: z.array(ItemIdSchema),
	updating: z.array(ItemIdSchema),
	deleting: z.array(ItemIdSchema),
});

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

export const ChannelsUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema.optional(),
	deviceId: ItemIdSchema.optional(),
});

export const ChannelsGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	deviceId: ItemIdSchema.optional(),
});

export const ChannelsFetchActionPayloadSchema = z.object({
	deviceId: ItemIdSchema.optional(),
});

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

export const ChannelsSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	deviceId: ItemIdSchema,
});

export const ChannelsRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	deviceId: ItemIdSchema.optional(),
});

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

export const ChannelUpdateReqSchema: ZodType<ApiUpdateChannel> = z.object({
	name: z.string().trim().nonempty().optional(),
	description: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
});

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
