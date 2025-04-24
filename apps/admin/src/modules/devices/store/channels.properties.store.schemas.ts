import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import {
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyData_type,
	DevicesModuleChannelPropertyPermissions,
	type components,
} from '../../../openapi';

import { ItemIdSchema } from './types';

type ApiCreateChannelProperty = components['schemas']['DevicesModuleCreateChannelProperty'];
type ApiUpdateChannelProperty = components['schemas']['DevicesModuleUpdateChannelProperty'];
type ApiChannelProperty = components['schemas']['DevicesModuleChannelProperty'];

// STORE STATE
// ===========

export const ChannelPropertySchema = z.object({
	id: ItemIdSchema,
	draft: z.boolean().default(false),
	channel: ItemIdSchema,
	category: z.nativeEnum(DevicesModuleChannelPropertyCategory).default(DevicesModuleChannelPropertyCategory.generic),
	name: z.string().trim().nullable(),
	permissions: z.array(z.nativeEnum(DevicesModuleChannelPropertyPermissions)),
	dataType: z.nativeEnum(DevicesModuleChannelPropertyData_type),
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

export const ChannelsPropertiesSetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	channelId: ItemIdSchema,
	data: z.object({
		category: z.nativeEnum(DevicesModuleChannelPropertyCategory).default(DevicesModuleChannelPropertyCategory.generic),
		name: z.string().trim().nullable(),
		permissions: z.array(z.nativeEnum(DevicesModuleChannelPropertyPermissions)),
		dataType: z.nativeEnum(DevicesModuleChannelPropertyData_type),
		unit: z.string().nullable(),
		format: z.array(z.union([z.string(), z.number()])).nullable(),
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
		category: z.nativeEnum(DevicesModuleChannelPropertyCategory).default(DevicesModuleChannelPropertyCategory.generic),
		name: z.string().trim().nullable(),
		permissions: z.array(z.nativeEnum(DevicesModuleChannelPropertyPermissions)),
		dataType: z.nativeEnum(DevicesModuleChannelPropertyData_type),
		unit: z.string().nullable(),
		format: z.array(z.union([z.string(), z.union([z.number(), z.null()])])).nullable(),
		invalid: z.union([z.string(), z.number(), z.boolean(), z.null()]),
		step: z.number().nullable(),
		value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
	}),
});

export const ChannelsPropertiesEditActionPayloadSchema = z.object({
	id: ItemIdSchema,
	channelId: ItemIdSchema,
	data: z.object({
		category: z.nativeEnum(DevicesModuleChannelPropertyCategory).optional(),
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
	category: z.nativeEnum(DevicesModuleChannelPropertyCategory),
	name: z.string().trim().nullable(),
	permissions: z.array(z.nativeEnum(DevicesModuleChannelPropertyPermissions)),
	data_type: z.nativeEnum(DevicesModuleChannelPropertyData_type),
	unit: z.string().nullable(),
	format: z.array(z.union([z.string(), z.number()])).nullable(),
	invalid: z.union([z.string(), z.number(), z.boolean(), z.null()]),
	step: z.number().nullable(),
	value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

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

export const ChannelPropertyResSchema: ZodType<ApiChannelProperty> = z.object({
	id: z.string().uuid(),
	channel: z.string().uuid(),
	category: z.nativeEnum(DevicesModuleChannelPropertyCategory),
	name: z.string().trim().nullable(),
	permissions: z.array(z.nativeEnum(DevicesModuleChannelPropertyPermissions)),
	data_type: z.nativeEnum(DevicesModuleChannelPropertyData_type),
	unit: z.string().nullable(),
	format: z.array(z.union([z.string(), z.number()])).nullable(),
	invalid: z.union([z.string(), z.number(), z.boolean(), z.null()]),
	step: z.number().nullable(),
	value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
	created_at: z.string().date(),
	updated_at: z.string().date().nullable(),
});
