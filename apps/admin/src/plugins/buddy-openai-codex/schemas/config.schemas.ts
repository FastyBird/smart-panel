import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const OpenAiCodexConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	clientId: z.string().nullable(),
	// Empty means "keep the stored value" - the backend never sends these back.
	clientSecret: z.string().nullable().optional(),
	accessToken: z.string().nullable().optional(),
	refreshToken: z.string().nullable().optional(),
	model: z.string().nullable(),
});
