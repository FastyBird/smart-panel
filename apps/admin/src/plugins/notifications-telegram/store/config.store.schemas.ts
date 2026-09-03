import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import {
	NotificationSeverity,
	type NotificationsTelegramPluginConfigSchema,
	type NotificationsTelegramPluginUpdateConfigSchema,
} from '../../../openapi.constants';
import { NOTIFICATIONS_TELEGRAM_PLUGIN_NAME } from '../notifications-telegram.constants';

type ApiUpdateConfig = NotificationsTelegramPluginUpdateConfigSchema;
type ApiConfig = NotificationsTelegramPluginConfigSchema;

export const NotificationsTelegramConfigSchema = ConfigPluginSchema.extend({
	// The backend redacts the token on read and answers with botTokenConfigured instead, so
	// the stored config has no token at all. It stays declared because the edit form writes a
	// replacement into it before submitting.
	botToken: z.string().trim().nullable().optional(),
	botTokenConfigured: z.boolean().default(false),
	chatId: z.string().trim().nullable().default(null),
	minSeverity: z.enum(['info', 'warning', 'error', 'critical']).default('warning'),
});

// BACKEND API
// ===========

export const NotificationsTelegramConfigUpdateReqSchema: ZodType<ApiUpdateConfig> = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(NOTIFICATIONS_TELEGRAM_PLUGIN_NAME),
		bot_token: z.string().nullable().optional(),
		chat_id: z.string().nullable().optional(),
		min_severity: z.nativeEnum(NotificationSeverity).optional(),
	})
);

export const NotificationsTelegramConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(NOTIFICATIONS_TELEGRAM_PLUGIN_NAME),
		bot_token: z.string().nullable().optional(),
		bot_token_configured: z.boolean(),
		chat_id: z.string().nullable().optional(),
		min_severity: z.nativeEnum(NotificationSeverity),
	})
);
