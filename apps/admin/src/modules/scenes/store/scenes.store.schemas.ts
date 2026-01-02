import { v4 as uuid } from 'uuid';
import { z } from 'zod';

import { SceneCategory } from '../scenes.constants';

import { SceneActionResSchema } from './scenes.actions.store.schemas';
import { ItemIdSchema } from './types';

// STORE STATE
// ===========

export const SceneSchema = z.object({
	id: ItemIdSchema,
	draft: z.boolean().default(false),
	primarySpaceId: ItemIdSchema.nullable().default(null),
	category: z.nativeEnum(SceneCategory).default(SceneCategory.GENERIC),
	name: z.string().trim().nonempty(),
	description: z.string().trim().nullable().default(null),
	order: z.number().int().min(0).default(0),
	enabled: z.boolean().default(true),
	triggerable: z.boolean().default(true),
	editable: z.boolean().default(true),
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
	data: z.object({}),
});

export const ScenesSetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	data: z
		.object({
			primarySpaceId: ItemIdSchema.nullable(),
			category: z.nativeEnum(SceneCategory).default(SceneCategory.GENERIC),
			name: z.string().trim().nonempty(),
			description: z
				.string()
				.trim()
				.transform((val) => (val === '' ? null : val))
				.nullable()
				.optional(),
			order: z.number().int().min(0).optional(),
			enabled: z.boolean(),
			triggerable: z.boolean(),
			editable: z.boolean(),
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
			primarySpaceId: ItemIdSchema.nullable().optional(),
			category: z.nativeEnum(SceneCategory).default(SceneCategory.GENERIC),
			name: z.string().trim().nonempty(),
			description: z
				.string()
				.trim()
				.transform((val) => (val === '' ? null : val))
				.nullable()
				.optional(),
			order: z.number().int().min(0).optional(),
			enabled: z.boolean().optional(),
		})
		.passthrough(),
});

export const ScenesEditActionPayloadSchema = z.object({
	id: ItemIdSchema,
	data: z
		.object({
			primarySpaceId: ItemIdSchema.nullable().optional(),
			name: z.string().trim().optional(),
			description: z
				.string()
				.trim()
				.transform((val) => (val === '' ? null : val))
				.nullable()
				.optional(),
			order: z.number().int().min(0).optional(),
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

export const SceneCreateReqSchema = z.object({
	id: z.string().uuid().optional(),
	primary_space_id: z.string().uuid().nullable().optional(),
	category: z.nativeEnum(SceneCategory).optional(),
	name: z.string().trim().nonempty(),
	description: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	order: z.number().int().min(0).optional(),
	enabled: z.boolean().optional(),
	triggerable: z.boolean().optional(),
});

export const SceneUpdateReqSchema = z.object({
	primary_space_id: z.string().uuid().nullable().optional(),
	category: z.nativeEnum(SceneCategory).optional(),
	name: z.string().trim().nonempty().optional(),
	description: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	order: z.number().int().min(0).optional(),
	enabled: z.boolean().optional(),
	triggerable: z.boolean().optional(),
});

export const SceneResSchema = z.object({
	id: z.string().uuid(),
	primary_space_id: z.string().uuid().nullable(),
	category: z.nativeEnum(SceneCategory),
	name: z.string().trim().nonempty(),
	description: z.string().trim().nullable(),
	order: z.number().int().min(0),
	enabled: z.boolean(),
	triggerable: z.boolean(),
	editable: z.boolean(),
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
