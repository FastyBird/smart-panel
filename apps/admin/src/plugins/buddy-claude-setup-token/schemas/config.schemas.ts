import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const ClaudeSetupTokenConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	accessToken: z.string().nullable(),
	model: z.string().nullable(),
});
