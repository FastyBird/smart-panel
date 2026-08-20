import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const HomeAssistantConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	// Absent or blank keeps the stored key and null removes it. The backend never sends
	// the key back, so the field always starts blank - which is why removing one needs a
	// gesture of its own rather than just clearing the input.
	apiKey: z.string().nullable().optional(),
	// What the backend answers with in place of the key. Declared so the form knows
	// whether there is anything to remove; the update request schema drops it again.
	apiKeyConfigured: z.boolean().optional(),
	hostname: z.string(),
});
