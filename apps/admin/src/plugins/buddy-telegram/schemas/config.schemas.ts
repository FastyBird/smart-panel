import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const TelegramConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	// Empty means "keep the stored token" - the backend never sends it back.
	botToken: z.string().nullable().optional(),
	allowedUserIds: z.string().nullable(),
});
