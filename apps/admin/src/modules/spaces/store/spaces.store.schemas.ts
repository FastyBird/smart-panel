import { z } from 'zod';

import { SpaceType } from '../spaces.constants';

export const SpaceSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1),
	description: z.string().nullable(),
	type: z.nativeEnum(SpaceType),
	icon: z.string().nullable(),
	displayOrder: z.number().int().min(0),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date().nullable(),
	draft: z.boolean().default(false),
});

export const SpaceCreateSchema = z.object({
	name: z.string().min(1, 'Name is required'),
	description: z.string().nullable().optional(),
	type: z.nativeEnum(SpaceType).optional(),
	icon: z.string().nullable().optional(),
	displayOrder: z.number().int().min(0).optional(),
});

export const SpaceEditSchema = z.object({
	name: z.string().min(1).optional(),
	description: z.string().nullable().optional(),
	type: z.nativeEnum(SpaceType).optional(),
	icon: z.string().nullable().optional(),
	displayOrder: z.number().int().min(0).optional(),
});
