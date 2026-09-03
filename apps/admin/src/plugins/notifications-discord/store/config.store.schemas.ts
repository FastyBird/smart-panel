import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import {
	NotificationSeverity,
	type NotificationsDiscordPluginConfigSchema,
	type NotificationsDiscordPluginUpdateConfigSchema,
} from '../../../openapi.constants';
import { NOTIFICATIONS_DISCORD_PLUGIN_NAME } from '../notifications-discord.constants';
import { DiscordWebhookUrlSchema } from '../schemas/discord-webhook-url.schemas';

type ApiUpdateConfig = NotificationsDiscordPluginUpdateConfigSchema;
type ApiConfig = NotificationsDiscordPluginConfigSchema;

export const NotificationsDiscordConfigSchema = ConfigPluginSchema.extend({
	// The backend redacts the webhook URL on read and answers with webhookUrlConfigured
	// instead, so the stored config has no URL at all. It stays declared because the edit form
	// writes a replacement into it before submitting.
	webhookUrl: z.string().trim().nullable().optional(),
	webhookUrlConfigured: z.boolean().default(false),
	username: z.string().trim().nullable().default(null),
	minSeverity: z.enum(['info', 'warning', 'error', 'critical']).default('warning'),
});

// BACKEND API
// ===========

export const NotificationsDiscordConfigUpdateReqSchema: ZodType<ApiUpdateConfig> = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(NOTIFICATIONS_DISCORD_PLUGIN_NAME),
		webhook_url: DiscordWebhookUrlSchema.nullable().optional(),
		username: z.string().nullable().optional(),
		min_severity: z.nativeEnum(NotificationSeverity).optional(),
	})
);

export const NotificationsDiscordConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(NOTIFICATIONS_DISCORD_PLUGIN_NAME),
		webhook_url: DiscordWebhookUrlSchema.nullable().optional(),
		webhook_url_configured: z.boolean(),
		username: z.string().nullable().optional(),
		min_severity: z.nativeEnum(NotificationSeverity),
	})
);
