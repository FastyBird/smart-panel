import { z } from 'zod';

import { ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { BUDDY_TELEGRAM_PLUGIN_NAME } from '../buddy-telegram.constants';

export const TelegramConfigSchema = ConfigPluginSchema.extend({
	// The backend redacts the token on read and answers with botTokenConfigured
	// instead, so the stored config has no botToken at all. It stays declared
	// because the edit form writes a replacement into it before submitting.
	botToken: z.string().trim().nullable().optional(),
	botTokenConfigured: z.boolean().default(false),
	allowedUserIds: z.string().trim().nullable().default(null),
});

// BACKEND API
// ===========

export const TelegramConfigUpdateReqSchema= ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(BUDDY_TELEGRAM_PLUGIN_NAME),
		bot_token: z.string().trim().nullable().optional(),
		allowed_user_ids: z.string().trim().nullable().optional(),
	})
);
