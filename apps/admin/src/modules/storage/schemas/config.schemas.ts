import { z } from 'zod';

import { ConfigModuleEditFormSchema } from '../../config';

export const StorageConfigEditFormSchema = ConfigModuleEditFormSchema.extend({
	primaryStorage: z.string().min(1),
	fallbackStorage: z.string().optional(),
});
