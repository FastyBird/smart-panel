import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const SttWhisperLocalConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	model: z.string().nullable(),
	language: z.string().nullable(),
});
