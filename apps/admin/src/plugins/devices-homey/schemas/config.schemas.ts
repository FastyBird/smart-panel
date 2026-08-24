import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

import { HomeyUrlSchema } from './homey-url.schemas';

export const HomeyConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	url: HomeyUrlSchema.nullable().optional(),
	apiKey: z.string().nullable().optional(),
	apiKeyConfigured: z.boolean().optional(),
	connectionTimeout: z.coerce.number().int().min(1_000).max(120_000),
	reconciliationInterval: z.coerce.number().int().min(30_000).max(86_400_000),
});
