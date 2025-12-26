import { type ZodType, z } from 'zod';

import { PageCreateReqSchema, PageResSchema, PageSchema, PageUpdateReqSchema } from '../../../modules/dashboard';
import { ItemIdSchema } from '../../../modules/devices';
import { PAGES_SPACE_TYPE, QuickActionType } from '../pages-space.constants';

// STORE STATE
// ===========

export const SpacePageSchema = PageSchema.extend({
	space: ItemIdSchema,
	viewMode: z.enum(['simple', 'advanced']).nullable().optional(),
	quickActions: z.array(z.nativeEnum(QuickActionType)).nullable().optional(),
});

// BACKEND API
// ===========

export const SpacePageCreateReqSchema: ZodType = PageCreateReqSchema.and(
	z.object({
		type: z.literal(PAGES_SPACE_TYPE),
		space_id: z.string().uuid(),
		view_mode: z.enum(['simple', 'advanced']).nullable().optional(),
		quick_actions: z.array(z.nativeEnum(QuickActionType)).nullable().optional(),
	})
);

export const SpacePageUpdateReqSchema: ZodType = PageUpdateReqSchema.and(
	z.object({
		type: z.literal(PAGES_SPACE_TYPE),
		space_id: z.string().uuid().optional(),
		view_mode: z.enum(['simple', 'advanced']).nullable().optional(),
		quick_actions: z.array(z.nativeEnum(QuickActionType)).nullable().optional(),
	})
);

export const SpacePageResSchema: ZodType = PageResSchema.and(
	z.object({
		type: z.literal(PAGES_SPACE_TYPE),
		space_id: z.string().uuid(),
		view_mode: z.enum(['simple', 'advanced']).nullable().optional(),
		quick_actions: z.array(z.nativeEnum(QuickActionType)).nullable().optional(),
	})
);
