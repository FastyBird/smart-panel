import { z } from 'zod';

import { ConfigModuleEditFormSchema } from '../../config';

export const InfluxDbConfigEditFormSchema = ConfigModuleEditFormSchema.extend({
	host: z.string().min(1),
	database: z.string().min(1),
	username: z.string().optional(),
	password: z.string().optional(),
});
