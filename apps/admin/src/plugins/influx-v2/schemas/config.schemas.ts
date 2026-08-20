import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const InfluxV2ConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	url: z.string().min(1),
	org: z.string().min(1),
	bucket: z.string().min(1),
	// Absent or blank keeps the stored token and null removes it. The backend never sends
	// the token back, so the field always starts blank - which is why removing one needs a
	// gesture of its own rather than just clearing the input.
	token: z.string().nullable().optional(),
	// What the backend answers with in place of the token. Declared so the form knows
	// whether there is anything to remove; the update request schema drops it again.
	tokenConfigured: z.boolean().optional(),
});
