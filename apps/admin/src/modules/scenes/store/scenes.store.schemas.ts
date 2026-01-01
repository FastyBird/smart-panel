import { v4 as uuid } from 'uuid';
import { z } from 'zod';

import { SceneCategory } from '../scenes.constants';

import { ItemIdSchema } from './types';

// STORE STATE
// ===========

export const SceneActionSchema = z.object({
	id: ItemIdSchema,
	type: z.string().trim().nonempty(),
	deviceId: ItemIdSchema,
	channelId: ItemIdSchema.nullable().default(null),
	propertyId: ItemIdSchema,
	value: z.union([z.string(), z.number(), z.boolean()]),
	order: z.number().int().min(0).default(0),
	enabled: z.boolean().default(true),
	scene: ItemIdSchema.optional(),
	createdAt: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date)))
		.optional()
		.default(() => new Date()),
	updatedAt: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date)))
		.optional()
		.nullable()
		.default(null),
});

export const SceneSchema = z.object({
	id: ItemIdSchema,
	draft: z.boolean().default(false),
	type: z.string().trim().nonempty(),
	spaceId: ItemIdSchema,
	category: z.nativeEnum(SceneCategory).default(SceneCategory.GENERIC),
	name: z.string().trim().nonempty(),
	description: z.string().trim().nullable().default(null),
	icon: z.string().trim().nullable().default(null),
	displayOrder: z.number().int().min(0).default(0),
	enabled: z.boolean().default(true),
	isTriggerable: z.boolean().default(true),
	isEditable: z.boolean().default(true),
	lastTriggeredAt: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date)))
		.nullable()
		.default(null),
	createdAt: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
	updatedAt: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date)))
		.optional()
		.nullable()
		.default(null),
	actions: z.array(SceneActionSchema).default([]),
});

export const ScenesStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.boolean().default(false),
		item: z.array(ItemIdSchema),
	}),
	creating: z.array(ItemIdSchema),
	updating: z.array(ItemIdSchema),
	deleting: z.array(ItemIdSchema),
	triggering: z.array(ItemIdSchema),
});

// STORE ACTIONS
// =============

export const ScenesOnEventActionPayloadSchema = z.object({
	id: ItemIdSchema,
	type: z.string().trim().nonempty(),
	data: z.object({}),
});

export const ScenesSetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	data: z
		.object({
			type: z.string().trim().nonempty(),
			spaceId: ItemIdSchema,
			category: z.nativeEnum(SceneCategory).default(SceneCategory.GENERIC),
			name: z.string().trim().nonempty(),
			description: z
				.string()
				.trim()
				.transform((val) => (val === '' ? null : val))
				.nullable()
				.optional(),
			icon: z
				.string()
				.trim()
				.transform((val) => (val === '' ? null : val))
				.nullable()
				.optional(),
			displayOrder: z.number().int().min(0).optional(),
			enabled: z.boolean(),
			isTriggerable: z.boolean(),
			isEditable: z.boolean(),
			lastTriggeredAt: z.date().nullable().optional(),
		})
		.passthrough(),
});

export const ScenesUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema,
});

export const ScenesGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
});

export const ScenesAddActionPayloadSchema = z.object({
	id: ItemIdSchema.optional().default(() => uuid()),
	draft: z.boolean().optional().default(false),
	data: z
		.object({
			type: z.string().trim().nonempty(),
			spaceId: ItemIdSchema,
			category: z.nativeEnum(SceneCategory).default(SceneCategory.GENERIC),
			name: z.string().trim().nonempty(),
			description: z
				.string()
				.trim()
				.transform((val) => (val === '' ? null : val))
				.nullable()
				.optional(),
			icon: z
				.string()
				.trim()
				.transform((val) => (val === '' ? null : val))
				.nullable()
				.optional(),
			displayOrder: z.number().int().min(0).optional(),
			enabled: z.boolean().optional(),
		})
		.passthrough(),
});

export const ScenesEditActionPayloadSchema = z.object({
	id: ItemIdSchema,
	data: z
		.object({
			type: z.string().trim().nonempty(),
			spaceId: ItemIdSchema.optional(),
			name: z.string().trim().optional(),
			description: z
				.string()
				.trim()
				.transform((val) => (val === '' ? null : val))
				.nullable()
				.optional(),
			icon: z
				.string()
				.trim()
				.transform((val) => (val === '' ? null : val))
				.nullable()
				.optional(),
			displayOrder: z.number().int().min(0).optional(),
			enabled: z.boolean().optional(),
		})
		.passthrough(),
});

export const ScenesSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
});

export const ScenesRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
});

export const ScenesTriggerActionPayloadSchema = z.object({
	id: ItemIdSchema,
	source: z.string().optional(),
	context: z.record(z.unknown()).optional(),
});

// BACKEND API
// ===========

// Note: These schemas are for local scene actions (type: "local") which use flat fields.
// Other scene plugins may use the `configuration` object instead.
// The backend type mapper routes to the correct DTO based on the `type` field.

export const SceneActionCreateReqSchema = z.object({
	id: z.string().uuid().optional(),
	type: z.string().trim().nonempty(),
	device_id: z.string().uuid(),
	channel_id: z.string().uuid().nullable().optional(),
	property_id: z.string().uuid(),
	value: z.union([z.string(), z.number(), z.boolean()]),
	order: z.number().int().min(0).optional(),
	enabled: z.boolean().optional(),
});

export const SceneActionUpdateReqSchema = z.object({
	type: z.string().trim().nonempty(),
	device_id: z.string().uuid().optional(),
	channel_id: z.string().uuid().nullable().optional(),
	property_id: z.string().uuid().optional(),
	value: z.union([z.string(), z.number(), z.boolean()]).optional(),
	order: z.number().int().min(0).optional(),
	enabled: z.boolean().optional(),
});

export const SceneActionResSchema = z.object({
	id: z.string().uuid(),
	type: z.string(),
	device_id: z.string().uuid(),
	channel_id: z.string().uuid().nullable(),
	property_id: z.string().uuid(),
	value: z.union([z.string(), z.number(), z.boolean()]),
	order: z.number(),
	enabled: z.boolean(),
	scene: z.string().uuid(),
	created_at: z.string(),
	updated_at: z.string().nullable(),
});

export const SceneCreateReqSchema = z.object({
	id: z.string().uuid().optional(),
	type: z.string().trim().nonempty(),
	space_id: z.string().uuid(),
	category: z.nativeEnum(SceneCategory).optional(),
	name: z.string().trim().nonempty(),
	description: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	icon: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	display_order: z.number().int().min(0).optional(),
	enabled: z.boolean().optional(),
	is_triggerable: z.boolean().optional(),
	actions: z.array(SceneActionCreateReqSchema).optional(),
});

export const SceneUpdateReqSchema = z.object({
	type: z.string().trim().nonempty(),
	space_id: z.string().uuid().optional(),
	category: z.nativeEnum(SceneCategory).optional(),
	name: z.string().trim().nonempty().optional(),
	description: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	icon: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	display_order: z.number().int().min(0).optional(),
	enabled: z.boolean().optional(),
	is_triggerable: z.boolean().optional(),
});

export const SceneResSchema = z.object({
	id: z.string().uuid(),
	type: z.string(),
	space_id: z.string().uuid(),
	category: z.nativeEnum(SceneCategory),
	name: z.string().trim().nonempty(),
	description: z.string().trim().nullable(),
	icon: z.string().trim().nullable(),
	display_order: z.number().int().min(0),
	enabled: z.boolean(),
	is_triggerable: z.boolean(),
	is_editable: z.boolean(),
	last_triggered_at: z.string().nullable(),
	created_at: z.string(),
	updated_at: z.string().nullable(),
	actions: z.array(SceneActionResSchema),
});

export const SceneTriggerReqSchema = z.object({
	source: z.string().optional(),
	context: z.record(z.unknown()).optional(),
});

export const SceneExecutionResSchema = z.object({
	scene_id: z.string().uuid(),
	status: z.enum(['pending', 'running', 'completed', 'failed', 'partially_completed']),
	triggered_by: z.string().nullable(),
	triggered_at: z.string(),
	completed_at: z.string().nullable(),
	total_actions: z.number(),
	successful_actions: z.number(),
	failed_actions: z.number(),
	action_results: z.array(
		z.object({
			action_id: z.string().uuid(),
			success: z.boolean(),
			error: z.string().nullable().optional(),
			execution_time_ms: z.number(),
		})
	),
	error: z.string().nullable(),
});
