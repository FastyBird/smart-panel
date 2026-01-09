import { z } from 'zod';

import { SpaceCategory, SpaceType } from '../spaces.constants';

export const SpacesFilterSchema = z.object({
	search: z.string().optional(),
	type: z.union([z.nativeEnum(SpaceType), z.literal('all')]).default('all'),
});

export type SpacesFilterSchemaType = z.infer<typeof SpacesFilterSchema>;

// Base schema for space form fields
const SpaceFormBaseSchema = z.object({
	name: z.string().min(1),
	description: z.string().nullable().optional(),
	category: z.nativeEnum(SpaceCategory).nullable().optional(),
	icon: z.string().nullable().optional(),
	displayOrder: z.number().int().min(0).default(0),
	parentId: z.string().uuid().nullable().optional(),
});

// Add form schema - includes type selection
export const SpaceAddFormSchema = SpaceFormBaseSchema.extend({
	id: z.string().uuid(),
	type: z.nativeEnum(SpaceType).default(SpaceType.ROOM),
});

export type SpaceAddFormSchemaType = z.infer<typeof SpaceAddFormSchema>;

// Edit form schema - type is not editable
export const SpaceEditFormSchema = SpaceFormBaseSchema.extend({
	id: z.string().uuid(),
	type: z.nativeEnum(SpaceType),
	suggestionsEnabled: z.boolean().default(true),
});

export type SpaceEditFormSchemaType = z.infer<typeof SpaceEditFormSchema>;
