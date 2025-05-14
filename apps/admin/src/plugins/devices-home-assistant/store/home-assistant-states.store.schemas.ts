import { type ZodType, z } from 'zod';

import type { components } from '../../../openapi';

type ApiState = components['schemas']['DevicesHomeAssistantPluginState'];

// STORE STATE
// ===========

export const HomeAssistantStateSchema = z.object({
	entityId: z.string().trim().nonempty(),
	state: z.union([z.string(), z.number(), z.boolean()]),
	attributes: z.record(z.unknown()),
	lastChanged: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date)))
		.optional()
		.nullable()
		.default(null),
	lastReported: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date)))
		.optional()
		.nullable()
		.default(null),
	lastUpdated: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date)))
		.optional()
		.nullable()
		.default(null),
});

export const HomeAssistantStatesStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.boolean().default(false),
		item: z.array(z.string()),
	}),
});

// STORE ACTIONS
// =============

export const HomeAssistantStatesSetActionPayloadSchema = z.object({
	entityId: z.string().trim().nonempty(),
	data: z.object({
		state: z.union([z.string(), z.number(), z.boolean()]),
		attributes: z.record(z.unknown()),
		lastChanged: z
			.union([z.string().datetime({ offset: true }), z.date()])
			.transform((date) => (date instanceof Date ? date : new Date(date)))
			.optional()
			.nullable()
			.default(null),
		lastReported: z
			.union([z.string().datetime({ offset: true }), z.date()])
			.transform((date) => (date instanceof Date ? date : new Date(date)))
			.optional()
			.nullable()
			.default(null),
		lastUpdated: z
			.union([z.string().datetime({ offset: true }), z.date()])
			.transform((date) => (date instanceof Date ? date : new Date(date)))
			.optional()
			.nullable()
			.default(null),
	}),
});

export const HomeAssistantStatesUnsetActionPayloadSchema = z.object({
	entityId: z.string().trim().nonempty(),
});

export const HomeAssistantStatesGetActionPayloadSchema = z.object({
	entityId: z.string().trim().nonempty(),
});

// BACKEND API
// ===========

export const HomeAssistantStateResSchema: ZodType<ApiState> = z.object({
	entity_id: z.string().trim().nonempty(),
	state: z.union([z.string(), z.number(), z.boolean()]),
	attributes: z.record(z.unknown()),
	last_changed: z.string().date().nullable(),
	last_reported: z.string().date().nullable(),
	last_updated: z.string().date().nullable(),
});
