import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const OpenAiConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	// Empty means "keep the stored key" - the backend never sends it back.
	apiKey: z.string().nullable().optional(),
	model: z.string().nullable(),
});
