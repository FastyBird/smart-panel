import { v4 as uuid } from 'uuid';
import { z } from 'zod';

import { ItemIdSchema } from './types';

// STORE STATE
// ===========

export const SceneActionSchema = z
	.object({
		id: ItemIdSchema,
		draft: z.boolean().default(false),
		type: z.string().trim().nonempty(),
		scene: ItemIdSchema,
		configuration: z.record(z.unknown()).default({}),
		order: z.number().int().min(0).default(0),
		enabled: z.boolean().default(true),
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
	})
	.passthrough();

export const ScenesActionsStateSemaphoreSchema = z.object({
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

export const ScenesActionsOnEventActionPayloadSchema = z.object({
	id: ItemIdSchema,
	type: z.string().trim().nonempty(),
	data: z.object({}).passthrough(),
});

export const ScenesActionsSetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	data: z
		.object({
			type: z.string().trim().nonempty(),
			scene: ItemIdSchema,
			configuration: z.record(z.unknown()).default({}),
			order: z.number().int().min(0).default(0),
			enabled: z.boolean().default(true),
		})
		.passthrough(),
});

export const ScenesActionsUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema.optional(),
	sceneId: ItemIdSchema.optional(),
});

export const ScenesActionsGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	sceneId: ItemIdSchema,
});

export const ScenesActionsFetchActionPayloadSchema = z.object({
	sceneId: ItemIdSchema,
});

export const ScenesActionsAddActionPayloadSchema = z.object({
	id: ItemIdSchema.optional().default(() => uuid()),
	sceneId: ItemIdSchema,
	draft: z.boolean().optional().default(false),
	data: z
		.object({
			type: z.string().trim().nonempty(),
			configuration: z.record(z.unknown()).default({}),
			order: z.number().int().min(0).optional().default(0),
			enabled: z.boolean().optional().default(true),
		})
		.passthrough(),
});

export const ScenesActionsEditActionPayloadSchema = z.object({
	id: ItemIdSchema,
	sceneId: ItemIdSchema,
	data: z
		.object({
			type: z.string().trim().nonempty(),
			configuration: z.record(z.unknown()).optional(),
			order: z.number().int().min(0).optional(),
			enabled: z.boolean().optional(),
		})
		.passthrough(),
});

export const ScenesActionsSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	sceneId: ItemIdSchema,
});

export const ScenesActionsRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	sceneId: ItemIdSchema,
});

// BACKEND API
// ===========

export const SceneActionCreateReqSchema = z
	.object({
		id: z.string().uuid().optional(),
		type: z.string().trim().nonempty(),
		configuration: z.record(z.unknown()).optional(),
		order: z.number().int().min(0).optional(),
		enabled: z.boolean().optional(),
	})
	.passthrough();

export const SceneActionUpdateReqSchema = z
	.object({
		type: z.string().trim().nonempty(),
		configuration: z.record(z.unknown()).optional(),
		order: z.number().int().min(0).optional(),
		enabled: z.boolean().optional(),
	})
	.passthrough();

export const SceneActionResSchema = z
	.object({
		id: z.string().uuid(),
		type: z.string(),
		configuration: z.record(z.unknown()).optional().default({}),
		order: z.number(),
		enabled: z.boolean(),
		scene: z.string().uuid(),
		created_at: z.string(),
		updated_at: z.string().nullable().optional(),
	})
	.passthrough();
