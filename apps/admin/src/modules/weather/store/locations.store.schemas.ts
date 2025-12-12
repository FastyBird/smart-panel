import { v4 as uuid } from 'uuid';
import { z } from 'zod';

import { ItemIdSchema } from '../../devices/store/types';

// STORE STATE
// ===========

export const WeatherLocationSchema = z.object({
	id: ItemIdSchema,
	draft: z.boolean().default(false),
	type: z.string().trim().nonempty(),
	name: z.string().trim().nonempty(),
	order: z.number().int().nonnegative().default(0),
	createdAt: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date))),
	updatedAt: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date)))
		.optional()
		.nullable()
		.default(null),
});

export const WeatherLocationsStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.boolean().default(false),
		item: z.array(ItemIdSchema),
	}),
	creating: z.array(ItemIdSchema),
	updating: z.array(ItemIdSchema),
	deleting: z.array(ItemIdSchema),
});

// STORE ACTIONS
// =============

export const WeatherLocationsOnEventActionPayloadSchema = z.object({
	id: ItemIdSchema,
	type: z.string().trim().nonempty(),
	data: z.object({}),
});

export const WeatherLocationsSetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	data: z
		.object({
			type: z.string().trim().nonempty(),
			name: z.string().trim().nonempty(),
		})
		.passthrough(),
});

export const WeatherLocationsUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema,
});

export const WeatherLocationsGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
});

export const WeatherLocationsAddActionPayloadSchema = z.object({
	id: ItemIdSchema.optional().default(uuid()),
	draft: z.boolean().optional().default(false),
	data: z
		.object({
			type: z.string().trim().nonempty(),
			name: z.string().trim().nonempty(),
		})
		.passthrough(),
});

export const WeatherLocationsEditActionPayloadSchema = z.object({
	id: ItemIdSchema,
	data: z
		.object({
			type: z.string().trim().nonempty(),
			name: z.string().trim().optional(),
		})
		.passthrough(),
});

export const WeatherLocationsSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
});

export const WeatherLocationsRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
});

// BACKEND API
// ===========

export const WeatherLocationCreateReqSchema = z.object({
	id: z.string().uuid().optional(),
	type: z.string().trim().nonempty(),
	name: z.string().trim().nonempty(),
});

export const WeatherLocationUpdateReqSchema = z.object({
	type: z.string().trim().nonempty(),
	name: z.string().trim().nonempty().optional(),
});

export const WeatherLocationResSchema = z.object({
	id: z.string().uuid(),
	type: z.string(),
	name: z.string().trim().nonempty(),
	order: z.number().int().nonnegative().default(0),
	created_at: z.string(),
	updated_at: z.string().nullable(),
});

// FORMS
// =====

export const WeatherLocationAddFormSchema = z.object({
	id: ItemIdSchema,
	type: z.string().trim().nonempty(),
	name: z.string().trim().min(1, 'Name is required'),
});

export const WeatherLocationEditFormSchema = z.object({
	name: z.string().trim().min(1, 'Name is required'),
});
