import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import {
	NotificationSeverity,
	type NotificationsSlackPluginConfigSchema,
	type NotificationsSlackPluginUpdateConfigSchema,
} from '../../../openapi.constants';
import { NOTIFICATIONS_SLACK_PLUGIN_NAME } from '../notifications-slack.constants';
import { SlackWebhookUrlSchema } from '../schemas/slack-webhook-url.schemas';

type ApiUpdateConfig = NotificationsSlackPluginUpdateConfigSchema;
type ApiConfig = NotificationsSlackPluginConfigSchema;

export const SlackConfigSchema = ConfigPluginSchema.extend({
	// The backend redacts the webhook URL on read and answers with webhookUrlConfigured
	// instead, so the stored config has no URL at all. It stays declared because the edit form
	// writes a replacement into it before submitting.
	webhookUrl: z.string().trim().nullable().optional(),
	webhookUrlConfigured: z.boolean().default(false),
	minSeverity: z.enum(['info', 'warning', 'error', 'critical']).default('warning'),
});

// BACKEND API
// ===========

export const SlackConfigUpdateReqSchema: ZodType<ApiUpdateConfig> = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(NOTIFICATIONS_SLACK_PLUGIN_NAME),
		webhook_url: SlackWebhookUrlSchema.nullable().optional(),
		min_severity: z.nativeEnum(NotificationSeverity).optional(),
	})
);

export const SlackConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(NOTIFICATIONS_SLACK_PLUGIN_NAME),
		webhook_url: SlackWebhookUrlSchema.nullable().optional(),
		webhook_url_configured: z.boolean(),
		min_severity: z.nativeEnum(NotificationSeverity),
	})
);
