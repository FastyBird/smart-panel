import { type ZodType, z } from 'zod';

import { PageCreateReqSchema, PageResSchema, PageSchema, PageUpdateReqSchema } from '../../../modules/dashboard';
import { PAGES_HOUSE_MODES_TYPE } from '../pages-house-modes.constants';

// STORE STATE
// ===========

export const HouseModesPageSchema = PageSchema.extend({
	confirmOnAway: z.boolean().nullable().optional(),
	showLastChanged: z.boolean().nullable().optional(),
});

// BACKEND API
// ===========

export const HouseModesPageCreateReqSchema: ZodType = PageCreateReqSchema.and(
	z.object({
		type: z.literal(PAGES_HOUSE_MODES_TYPE),
		confirm_on_away: z.boolean().nullable().optional(),
		show_last_changed: z.boolean().nullable().optional(),
	})
);

export const HouseModesPageUpdateReqSchema: ZodType = PageUpdateReqSchema.and(
	z.object({
		type: z.literal(PAGES_HOUSE_MODES_TYPE),
		confirm_on_away: z.boolean().nullable().optional(),
		show_last_changed: z.boolean().nullable().optional(),
	})
);

export const HouseModesPageResSchema: ZodType = PageResSchema.and(
	z.object({
		type: z.literal(PAGES_HOUSE_MODES_TYPE),
		confirm_on_away: z.boolean().nullable().optional(),
		show_last_changed: z.boolean().nullable().optional(),
	})
);
