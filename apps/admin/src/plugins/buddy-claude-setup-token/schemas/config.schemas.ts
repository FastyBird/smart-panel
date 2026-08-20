import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const ClaudeSetupTokenConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	// Empty means "keep the stored token" - the backend never sends it back.
	accessToken: z.string().nullable().optional(),
	model: z.string().nullable(),
});
