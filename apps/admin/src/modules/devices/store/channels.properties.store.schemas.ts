import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import {
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyDataType,
	DevicesModuleChannelPropertyPermissions,
	type components,
} from '../../../openapi.constants';

import { ItemIdSchema } from './types';

type ApiCreateChannelProperty = components['schemas']['DevicesModuleCreateChannelProperty'];
type ApiUpdateChannelProperty = components['schemas']['DevicesModuleUpdateChannelProperty'];
type ApiChannelProperty = components['schemas']['DevicesModuleDataChannelProperty'];

// STORE STATE
// ===========

export const ChannelPropertySchema = z.object({
	id: ItemIdSchema,
	draft: z.boolean().default(false),
	type: z.string().trim().nonempty(),
	channel: ItemIdSchema,
	category: z.nativeEnum(DevicesModuleChannelPropertyCategory).default(DevicesModuleChannelPropertyCategory.generic),
	identifier: z.string().trim().nonempty().nullable(),
	name: z.string().trim().nullable(),
	permissions: z.array(z.nativeEnum(DevicesModuleChannelPropertyPermissions)),
	dataType: z.nativeEnum(DevicesModuleChannelPropertyDataType),
	unit: z.string().nullable(),
	format: z.array(z.union([z.string(), z.union([z.number(), z.null()])])).nullable(),
	invalid: z.union([z.string(), z.number(), z.boolean(), z.null()]),
	step: z.number().nullable(),
	value: z.union([z.string(), z.number(), z.boolean(), z.null()]).default(null),
	createdAt: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
	updatedAt: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date)))
		.optional()
		.nullable()
		.default(null),
});

export const ChannelsPropertiesStateSemaphoreSchema = z.object({
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

export const ChannelsPropertiesOnEventActionPayloadSchema = z.object({
	id: ItemIdSchema,
	type: z.string().trim().nonempty(),
	data: z.object({}),
});

export const ChannelsPropertiesSetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	data: z.object({
		type: z.string().trim().nonempty(),
		category: z.nativeEnum(DevicesModuleChannelPropertyCategory).default(DevicesModuleChannelPropertyCategory.generic),
		identifier: z.string().trim().nonempty().nullable(),
		name: z.string().trim().nullable(),
		permissions: z.array(z.nativeEnum(DevicesModuleChannelPropertyPermissions)),
		dataType: z.nativeEnum(DevicesModuleChannelPropertyDataType),
		unit: z.string().nullable(),
		format: z.array(z.union([z.string(), z.union([z.number(), z.null()])])).nullable(),
		invalid: z.union([z.string(), z.number(), z.boolean(), z.null()]),
		step: z.number().nullable(),
		value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
	}),
});

export const ChannelsPropertiesUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema.optional(),
	channelId: ItemIdSchema.optional(),
});

export const ChannelsPropertiesGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	channelId: ItemIdSchema,
});

export const ChannelsPropertiesFetchActionPayloadSchema = z.object({
	channelId: ItemIdSchema,
});

export const ChannelsPropertiesAddActionPayloadSchema = z.object({
	id: ItemIdSchema.optional().default(uuid()),
	channelId: ItemIdSchema,
	draft: z.boolean().optional().default(false),
	data: z.object({
		type: z.string().trim().nonempty(),
		category: z.nativeEnum(DevicesModuleChannelPropertyCategory).default(DevicesModuleChannelPropertyCategory.generic),
		identifier: z.string().trim().nonempty().nullable().optional(),
		name: z.string().trim().nullable(),
		permissions: z.array(z.nativeEnum(DevicesModuleChannelPropertyPermissions)),
		dataType: z.nativeEnum(DevicesModuleChannelPropertyDataType),
		unit: z.string().nullable(),
		format: z.array(z.union([z.string(), z.union([z.number(), z.null()])])).nullable(),
		invalid: z.union([z.string(), z.number(), z.boolean(), z.null()]),
		step: z
			.union([z.string(), z.number()])
			.transform((val) => (val === '' ? undefined : Number(val)))
			.nullable(),
		value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
	}),
});

export const ChannelsPropertiesEditActionPayloadSchema = z.object({
	id: ItemIdSchema,
	channelId: ItemIdSchema,
	data: z.object({
		type: z.string().trim().nonempty(),
		category: z.nativeEnum(DevicesModuleChannelPropertyCategory).optional(),
		identifier: z.string().trim().nonempty().nullable().optional(),
		name: z.string().trim().nullable().optional(),
		unit: z.string().nullable().optional(),
		format: z
			.array(z.union([z.string(), z.union([z.number(), z.null()])]))
			.nullable()
			.optional(),
		invalid: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
		step: z
			.union([z.string(), z.number()])
			.transform((val) => (val === '' ? undefined : Number(val)))
			.nullable(),
		value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
	}),
});

export const ChannelsPropertiesSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	channelId: ItemIdSchema,
});

export const ChannelsPropertiesRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	channelId: ItemIdSchema,
});

// BACKEND API
// ===========

export const ChannelPropertyCreateReqSchema: ZodType<ApiCreateChannelProperty> = z.object({
	id: z.string().uuid().optional(),
	type: z.string().trim().nonempty(),
	category: z.nativeEnum(DevicesModuleChannelPropertyCategory),
	identifier: z.string().trim().nonempty().nullable().optional(),
	name: z.string().trim().nullable(),
	permissions: z.array(z.nativeEnum(DevicesModuleChannelPropertyPermissions)),
	data_type: z.nativeEnum(DevicesModuleChannelPropertyDataType),
	unit: z.string().nullable(),
	format: z.array(z.union([z.string(), z.union([z.number(), z.null()])])).nullable(),
	invalid: z.union([z.string(), z.number(), z.boolean(), z.null()]),
	step: z.number().nullable(),
	value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

export const ChannelPropertyUpdateReqSchema: ZodType<ApiUpdateChannelProperty> = z.object({
	type: z.string().trim().nonempty(),
	identifier: z.string().trim().nonempty().nullable().optional(),
	name: z.string().trim().nullable().optional(),
	unit: z.string().nullable().optional(),
	format: z
		.array(z.union([z.string(), z.union([z.number(), z.null()])]))
		.nullable()
		.optional(),
	invalid: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
	step: z.number().nullable().optional(),
	value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});

export const ChannelPropertyResSchema: ZodType<ApiChannelProperty> = z.object({
	id: z.string().uuid(),
	type: z.string().trim().nonempty(),
	channel: z.string().uuid(),
	category: z.nativeEnum(DevicesModuleChannelPropertyCategory),
	identifier: z.string().trim().nonempty().nullable(),
	name: z.string().trim().nullable(),
	permissions: z.array(z.nativeEnum(DevicesModuleChannelPropertyPermissions)),
	data_type: z.nativeEnum(DevicesModuleChannelPropertyDataType),
	unit: z.string().nullable(),
	format: z.array(z.union([z.string(), z.union([z.number(), z.null()])])).nullable(),
	invalid: z.union([z.string(), z.number(), z.boolean(), z.null()]),
	step: z.number().nullable(),
	value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
	created_at: z.string().date(),
	updated_at: z.string().date().nullable(),
});
