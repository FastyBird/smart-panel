import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const OpenAiConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	apiKey: z.string().nullable(),
	model: z.string().nullable(),
});
