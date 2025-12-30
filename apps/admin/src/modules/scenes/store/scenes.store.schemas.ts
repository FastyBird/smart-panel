import { v4 as uuid } from 'uuid';
import { z } from 'zod';

import { SceneCategory } from '../scenes.constants';

import { ItemIdSchema } from './types';

// STORE STATE
// ===========

export const SceneActionSchema = z.object({
	id: ItemIdSchema,
	type: z.string().trim().nonempty(),
	order: z.number().int().min(0).default(0),
	configuration: z.record(z.unknown()).default({}),
	enabled: z.boolean().default(true),
	scene: ItemIdSchema,
	createdAt: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
	updatedAt: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date)))
		.optional()
		.nullable()
		.default(null),
});

export const SceneConditionSchema = z.object({
	id: ItemIdSchema,
	type: z.string().trim().nonempty(),
	operator: z.enum(['and', 'or']).default('and'),
	configuration: z.record(z.unknown()).default({}),
	enabled: z.boolean().default(true),
	scene: ItemIdSchema,
	createdAt: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
	updatedAt: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date)))
		.optional()
		.nullable()
		.default(null),
});

export const SceneTriggerSchema = z.object({
	id: ItemIdSchema,
	type: z.string().trim().nonempty(),
	triggerType: z.enum(['manual', 'schedule', 'device_state', 'webhook', 'sunrise', 'sunset']).default('manual'),
	configuration: z.record(z.unknown()).default({}),
	enabled: z.boolean().default(true),
	scene: ItemIdSchema,
	createdAt: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
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
	category: z.nativeEnum(SceneCategory).default(SceneCategory.GENERIC),
	name: z.string().trim().nonempty(),
	description: z.string().trim().nullable().default(null),
	icon: z.string().trim().nullable().default(null),
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
	id: ItemIdSchema.optional().default(uuid()),
	draft: z.boolean().optional().default(false),
	data: z
		.object({
			type: z.string().trim().nonempty(),
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
			enabled: z.boolean().optional(),
		})
		.passthrough(),
});

export const ScenesEditActionPayloadSchema = z.object({
	id: ItemIdSchema,
	data: z
		.object({
			type: z.string().trim().nonempty(),
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

export const SceneActionCreateReqSchema = z.object({
	id: z.string().uuid().optional(),
	type: z.string().trim().nonempty(),
	order: z.number().int().min(0).optional(),
	configuration: z.record(z.unknown()),
	enabled: z.boolean().optional(),
});

export const SceneActionUpdateReqSchema = z.object({
	type: z.string().trim().nonempty(),
	order: z.number().int().min(0).optional(),
	configuration: z.record(z.unknown()).optional(),
	enabled: z.boolean().optional(),
});

export const SceneActionResSchema = z.object({
	id: z.string().uuid(),
	type: z.string(),
	order: z.number(),
	configuration: z.record(z.unknown()),
	enabled: z.boolean(),
	scene: z.string().uuid(),
	created_at: z.string(),
	updated_at: z.string().nullable(),
});

export const SceneConditionResSchema = z.object({
	id: z.string().uuid(),
	type: z.string(),
	operator: z.enum(['and', 'or']),
	configuration: z.record(z.unknown()),
	enabled: z.boolean(),
	scene: z.string().uuid(),
	created_at: z.string(),
	updated_at: z.string().nullable(),
});

export const SceneTriggerResSchema = z.object({
	id: z.string().uuid(),
	type: z.string(),
	trigger_type: z.enum(['manual', 'schedule', 'device_state', 'webhook', 'sunrise', 'sunset']),
	configuration: z.record(z.unknown()),
	enabled: z.boolean(),
	scene: z.string().uuid(),
	created_at: z.string(),
	updated_at: z.string().nullable(),
});

export const SceneCreateReqSchema = z.object({
	id: z.string().uuid().optional(),
	type: z.string().trim().nonempty(),
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
	enabled: z.boolean().optional(),
	actions: z.array(SceneActionCreateReqSchema).optional(),
});

export const SceneUpdateReqSchema = z.object({
	type: z.string().trim().nonempty(),
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
	enabled: z.boolean().optional(),
});

export const SceneResSchema = z.object({
	id: z.string().uuid(),
	type: z.string(),
	category: z.nativeEnum(SceneCategory),
	name: z.string().trim().nonempty(),
	description: z.string().trim().nullable(),
	icon: z.string().trim().nullable(),
	enabled: z.boolean(),
	is_triggerable: z.boolean(),
	is_editable: z.boolean(),
	last_triggered_at: z.string().nullable(),
	created_at: z.string(),
	updated_at: z.string().nullable(),
	actions: z.array(SceneActionResSchema),
	conditions: z.array(SceneConditionResSchema),
	triggers: z.array(SceneTriggerResSchema),
});

export const SceneTriggerReqSchema = z.object({
	source: z.string().optional(),
	context: z.record(z.unknown()).optional(),
});

export const SceneExecutionResSchema = z.object({
	scene_id: z.string().uuid(),
	status: z.enum(['pending', 'running', 'completed', 'failed', 'partially_completed']),
	triggered_by: z.string(),
	triggered_at: z.string(),
	completed_at: z.string().nullable(),
	total_actions: z.number(),
	successful_actions: z.number(),
	failed_actions: z.number(),
	results: z.array(
		z.object({
			action_id: z.string().uuid(),
			success: z.boolean(),
			error: z.string().nullable().optional(),
			executed_at: z.string(),
		})
	),
});
