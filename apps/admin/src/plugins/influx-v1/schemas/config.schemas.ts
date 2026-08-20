import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const InfluxV1ConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	host: z.string().min(1),
	database: z.string().min(1),
	username: z.string().nullable().optional(),
	// Absent or blank keeps the stored password and null removes it. The backend never sends
	// the password back, so the field always starts blank - which is why removing one needs a
	// gesture of its own rather than just clearing the input.
	password: z.string().nullable().optional(),
	// What the backend answers with in place of the password. Declared so the form knows
	// whether there is anything to remove; the update request schema drops it again.
	passwordConfigured: z.boolean().optional(),
});
