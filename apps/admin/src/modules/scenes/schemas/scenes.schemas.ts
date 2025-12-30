import { z } from 'zod';

import { SceneCategory } from '../scenes.constants';

export const SceneAddFormSchema = z.object({
	id: z.string().uuid().optional(),
	type: z.string().trim().nonempty(),
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
	category: z.nativeEnum(SceneCategory).default(SceneCategory.GENERIC),
	enabled: z.boolean().default(true),
	displayOrder: z.number().optional(),
	spaceId: z.string().uuid(),
});

export const SceneEditFormSchema = z.object({
	id: z.string().uuid(),
	type: z.string().trim().nonempty(),
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
	category: z.nativeEnum(SceneCategory).optional(),
	enabled: z.boolean().optional(),
	displayOrder: z.number().optional(),
	spaceId: z.string().uuid().optional(),
});
