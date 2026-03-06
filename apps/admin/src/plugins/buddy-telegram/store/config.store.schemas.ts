import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { BUDDY_TELEGRAM_PLUGIN_NAME } from '../buddy-telegram.constants';

export const TelegramConfigSchema = ConfigPluginSchema.extend({
	botToken: z.string().trim().nullable(),
	allowedUserIds: z.string().trim().nullable(),
});

// BACKEND API
// ===========

export const TelegramConfigUpdateReqSchema: ZodType = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(BUDDY_TELEGRAM_PLUGIN_NAME),
		bot_token: z.string().trim().nullable().optional(),
		allowed_user_ids: z.string().trim().nullable().optional(),
	})
);

export const TelegramConfigResSchema: ZodType = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(BUDDY_TELEGRAM_PLUGIN_NAME),
		bot_token: z.string().trim().nullable(),
		allowed_user_ids: z.string().trim().nullable(),
	})
);
