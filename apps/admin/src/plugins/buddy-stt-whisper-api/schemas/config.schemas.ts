import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const SttWhisperApiConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	apiKey: z.string().nullable(),
	model: z.string().nullable(),
	language: z.string().nullable(),
});
