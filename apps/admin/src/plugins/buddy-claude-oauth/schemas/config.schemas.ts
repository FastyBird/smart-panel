import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const ClaudeOauthConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	clientId: z.string().nullable(),
	clientSecret: z.string().nullable(),
	accessToken: z.string().nullable(),
	refreshToken: z.string().nullable(),
	model: z.string().nullable(),
});
