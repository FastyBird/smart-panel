import { z } from 'zod';

import { SpaceRoomCategory, SpaceType, SpaceZoneCategory } from '../spaces.constants';
import { StatusWidgetSchema } from '../store/spaces.store.schemas';

export const SpacesFilterSchema = z.object({
	search: z.string().optional(),
	types: z.array(z.string()),
});

export type SpacesFilterSchemaType = z.infer<typeof SpacesFilterSchema>;

// Base schema for space form fields
const SpaceFormBaseSchema = z.object({
	name: z.string().min(1),
	description: z.string().nullable().optional(),
	category: z.union([z.nativeEnum(SpaceRoomCategory), z.nativeEnum(SpaceZoneCategory)]).nullable().optional(),
	icon: z.string().nullable().optional(),
	displayOrder: z.number().int().min(0).default(0),
	parentId: z.string().uuid().nullable().optional(),
});

// Add form schema - includes type selection.
// Only ROOM and ZONE are user-creatable via the add form; MASTER and ENTRY
// are backend-seeded singletons and SIGNAGE_INFO_PANEL is provisioned by
// its plugin, so they must not round-trip through the generic add form
// even if someone bypasses the UI's hardcoded two-option dropdown.
export const SpaceAddFormSchema = SpaceFormBaseSchema.extend({
	id: z.string().uuid(),
	type: z.enum([SpaceType.ROOM, SpaceType.ZONE]).default(SpaceType.ROOM),
});

export type SpaceAddFormSchemaType = z.infer<typeof SpaceAddFormSchema>;

// Edit form schema - type is not editable
export const SpaceEditFormSchema = SpaceFormBaseSchema.extend({
	id: z.string().uuid(),
	type: z.nativeEnum(SpaceType),
	suggestionsEnabled: z.boolean().default(true),
	statusWidgets: z.array(StatusWidgetSchema).nullable().optional(),
});

export type SpaceEditFormSchemaType = z.infer<typeof SpaceEditFormSchema>;
