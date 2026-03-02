import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const ClaudeConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	apiKey: z.string().nullable(),
	model: z.string().nullable(),
});
