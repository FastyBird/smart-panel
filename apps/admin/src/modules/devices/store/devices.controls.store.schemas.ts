import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import { type components } from '../../../openapi';

import { ItemIdSchema } from './types';

type ApiCreateDeviceControl = components['schemas']['DevicesModuleCreateDeviceControl'];
type ApiDeviceControl = components['schemas']['DevicesModuleDeviceControl'];

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

export const DevicesControlsStateSemaphoreSchema = z.object({
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

export const DevicesControlsOnEventActionPayloadSchema = z.object({
	id: ItemIdSchema,
	data: z.object({}),
});

export const DevicesControlsSetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	data: z.object({
		name: z.string().trim().nonempty(),
	}),
});

export const DevicesControlsUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema.optional(),
	deviceId: ItemIdSchema.optional(),
});

export const DevicesControlsGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	deviceId: ItemIdSchema,
});

export const DevicesControlsFetchActionPayloadSchema = z.object({
	deviceId: ItemIdSchema,
});

export const DevicesControlsAddActionPayloadSchema = z.object({
	id: ItemIdSchema.optional().default(uuid()),
	deviceId: ItemIdSchema,
	draft: z.boolean().optional().default(false),
	data: z.object({
		name: z.string().trim().nonempty(),
	}),
});

export const DevicesControlsSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	deviceId: ItemIdSchema,
});

export const DevicesControlsRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	deviceId: ItemIdSchema,
});

// BACKEND API
// ===========

export const DeviceControlCreateReqSchema: ZodType<ApiCreateDeviceControl> = z.object({
	id: z.string().uuid().optional(),
	device: z.string().uuid(),
	name: z.string().trim().nonempty(),
});

export const DeviceControlResSchema: ZodType<ApiDeviceControl> = z.object({
	id: z.string().uuid(),
	device: z.string().uuid(),
	name: z.string().trim().nonempty(),
	created_at: z.string().date(),
	updated_at: z.string().date().nullable(),
});
