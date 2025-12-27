import { z } from 'zod';

import { PageAddFormSchema, PageEditFormSchema } from '../../../modules/dashboard';

export const HousePageAddFormSchema = PageAddFormSchema.extend({
	viewMode: z.enum(['simple', 'detailed']).optional().nullable(),
	showWeather: z.boolean().default(true),
});

export const HousePageEditFormSchema = PageEditFormSchema.extend({
	viewMode: z.enum(['simple', 'detailed']).optional().nullable(),
	showWeather: z.boolean().optional(),
});
