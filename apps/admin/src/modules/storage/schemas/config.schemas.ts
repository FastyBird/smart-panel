import { z } from 'zod';

import { ConfigModuleEditFormSchema } from '../../config';

export const StorageConfigEditFormSchema = ConfigModuleEditFormSchema.extend({
	primaryStorage: z.string().min(1),
	fallbackStorage: z.string().optional(),
	host: z.string().min(1),
	database: z.string().min(1),
	username: z.string().optional(),
	password: z.string().optional(),
});
