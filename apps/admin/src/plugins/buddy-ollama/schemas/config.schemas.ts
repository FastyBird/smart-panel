import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const OllamaConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	model: z.string().nullable(),
	baseUrl: z.string().nullable(),
});
