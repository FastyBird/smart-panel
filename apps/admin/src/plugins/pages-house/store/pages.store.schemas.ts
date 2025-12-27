import { type ZodType, z } from 'zod';

import { PageCreateReqSchema, PageResSchema, PageSchema, PageUpdateReqSchema } from '../../../modules/dashboard';
import { PAGES_HOUSE_TYPE } from '../pages-house.constants';

// STORE STATE
// ===========

export const HousePageSchema = PageSchema.extend({
	viewMode: z.enum(['simple', 'detailed']).nullable().optional(),
	showWeather: z.boolean().nullable().optional(),
});

// BACKEND API
// ===========

export const HousePageCreateReqSchema: ZodType = PageCreateReqSchema.and(
	z.object({
		type: z.literal(PAGES_HOUSE_TYPE),
		view_mode: z.enum(['simple', 'detailed']).nullable().optional(),
		show_weather: z.boolean().nullable().optional(),
	})
);

export const HousePageUpdateReqSchema: ZodType = PageUpdateReqSchema.and(
	z.object({
		type: z.literal(PAGES_HOUSE_TYPE),
		view_mode: z.enum(['simple', 'detailed']).nullable().optional(),
		show_weather: z.boolean().nullable().optional(),
	})
);

export const HousePageResSchema: ZodType = PageResSchema.and(
	z.object({
		type: z.literal(PAGES_HOUSE_TYPE),
		view_mode: z.enum(['simple', 'detailed']).nullable().optional(),
		show_weather: z.boolean().nullable().optional(),
	})
);
