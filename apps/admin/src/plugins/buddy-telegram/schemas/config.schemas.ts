import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const TelegramConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	botToken: z.string().nullable(),
	allowedUserIds: z.string().nullable(),
});
