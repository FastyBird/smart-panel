import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const HomeyConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	url: z.string().url().nullable().optional(),
	apiKey: z.string().nullable().optional(),
	apiKeyConfigured: z.boolean().optional(),
	connectionTimeout: z.coerce.number().int().min(1_000).max(120_000),
	reconciliationInterval: z.coerce.number().int().min(30_000).max(86_400_000),
});
