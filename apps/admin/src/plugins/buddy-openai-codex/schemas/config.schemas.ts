import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const OpenAiCodexConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	clientId: z.string().nullable(),
	// Absent or blank keeps the stored value and null removes it. The backend never sends
	// these back, so the fields always start blank - which is why removing one needs a
	// gesture of its own rather than just clearing the input. The two tokens have theirs in
	// the connect/disconnect pair; the client secret uses the shared remove control.
	clientSecret: z.string().nullable().optional(),
	accessToken: z.string().nullable().optional(),
	refreshToken: z.string().nullable().optional(),
	// What the backend answers with in place of the secrets above. Declared so the form
	// knows what is stored; the update request schema drops them again.
	clientSecretConfigured: z.boolean().optional(),
	accessTokenConfigured: z.boolean().optional(),
	refreshTokenConfigured: z.boolean().optional(),
	model: z.string().nullable(),
});
