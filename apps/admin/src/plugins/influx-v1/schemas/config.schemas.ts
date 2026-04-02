import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const InfluxV1ConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	host: z.string().min(1),
	database: z.string().min(1),
	username: z.string().nullable().optional(),
	password: z.string().nullable().optional(),
});
