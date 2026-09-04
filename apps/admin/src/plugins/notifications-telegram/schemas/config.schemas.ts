import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const NotificationsTelegramConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	// Absent or blank keeps the stored token and null removes it. The backend never sends
	// the token back, so the field always starts blank - which is why removing one needs a
	// gesture of its own rather than just clearing the input.
	botToken: z.string().nullable().optional(),
	// What the backend answers with in place of the token. Declared so the form knows
	// whether there is anything to remove; the update request schema drops it again.
	botTokenConfigured: z.boolean().optional(),
	chatId: z.string().nullable().optional(),
	minSeverity: z.enum(['info', 'warning', 'error', 'critical']),
});
