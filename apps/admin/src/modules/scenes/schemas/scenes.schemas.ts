import { z } from 'zod';

import { SceneCategory } from '../scenes.constants';

export const SceneActionAddFormSchema = z.object({
	id: z.string().uuid().optional(),
	type: z.string().trim().nonempty(),
	deviceId: z.string().uuid(),
	channelId: z.string().uuid().nullable().optional(),
	propertyId: z.string().uuid(),
	value: z.union([z.string(), z.number(), z.boolean()]),
	order: z.number().int().min(0).optional(),
	enabled: z.boolean().default(true),
});

export const SceneActionEditFormSchema = z.object({
	id: z.string().uuid(),
	type: z.string().trim().nonempty(),
	deviceId: z.string().uuid().optional(),
	channelId: z.string().uuid().nullable().optional(),
	propertyId: z.string().uuid().optional(),
	value: z.union([z.string(), z.number(), z.boolean()]).optional(),
	order: z.number().int().min(0).optional(),
	enabled: z.boolean().optional(),
});

export const SceneAddFormSchema = z.object({
	id: z.string().uuid().optional(),
	name: z.string().trim().nonempty(),
	description: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	category: z.nativeEnum(SceneCategory).default(SceneCategory.GENERIC),
	enabled: z.boolean().default(true),
	order: z.number().optional(),
	primarySpaceId: z
		.string()
		.uuid()
		.nullable()
		.optional()
		.transform((val) => (val === '' ? null : val)),
	actions: z.array(SceneActionAddFormSchema).default([]),
});

export const SceneEditFormSchema = z.object({
	id: z.string().uuid(),
	name: z.string().trim().nonempty().optional(),
	description: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	category: z.nativeEnum(SceneCategory).optional(),
	enabled: z.boolean().optional(),
	order: z.number().optional(),
	primarySpaceId: z
		.string()
		.uuid()
		.nullable()
		.optional()
		.transform((val) => (val === '' ? null : val)),
	actions: z.array(SceneActionAddFormSchema).default([]),
});
