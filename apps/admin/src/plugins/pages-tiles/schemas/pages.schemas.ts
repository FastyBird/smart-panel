import { z } from 'zod';

import { PageAddFormSchema, PageEditFormSchema } from '../../../modules/dashboard';

export const TilesPageAddFormSchema = PageAddFormSchema.extend({
	rows: z.number().gte(1).nullable().default(null),
	cols: z.number().gte(1).nullable().default(null),
	tileSize: z.number().gt(0).nullable().default(null),
});

export const TilesPageEditFormSchema = PageEditFormSchema.extend({
	rows: z.number().gte(1).nullable().default(null),
	cols: z.number().gte(1).nullable().default(null),
	tileSize: z.number().gt(0).nullable().default(null),
});
