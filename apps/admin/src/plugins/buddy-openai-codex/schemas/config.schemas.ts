import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const OpenAiCodexConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	clientId: z.string().nullable(),
	// Empty means "keep the stored value" - the backend never sends these back.
	clientSecret: z.string().nullable().optional(),
	accessToken: z.string().nullable().optional(),
	refreshToken: z.string().nullable().optional(),
	// The backend redacts the secrets above on read and sends these booleans instead.
	// Optional because the form can be constructed before a config has ever been read.
	clientSecretConfigured: z.boolean().optional(),
	accessTokenConfigured: z.boolean().optional(),
	refreshTokenConfigured: z.boolean().optional(),
	model: z.string().nullable(),
});
