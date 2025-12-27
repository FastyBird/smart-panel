import { z } from 'zod';

import { PageAddFormSchema, PageEditFormSchema } from '../../../modules/dashboard';

export const HouseModesPageAddFormSchema = PageAddFormSchema.extend({
	confirmOnAway: z.boolean().default(true),
	showLastChanged: z.boolean().default(true),
});

export const HouseModesPageEditFormSchema = PageEditFormSchema.extend({
	confirmOnAway: z.boolean().optional(),
	showLastChanged: z.boolean().optional(),
});
