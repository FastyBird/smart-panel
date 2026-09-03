import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import {
	NotificationSeverity,
	type NotificationsWebhookPluginConfigSchema,
	type NotificationsWebhookPluginUpdateConfigSchema,
} from '../../../openapi.constants';
import { NOTIFICATIONS_WEBHOOK_PLUGIN_NAME } from '../notifications-webhook.constants';
import { isValidHeadersJson, parseHeadersJson } from '../schemas/webhook-headers.schemas';
import { WebhookUrlSchema } from '../schemas/webhook-url.schemas';

type ApiUpdateConfig = NotificationsWebhookPluginUpdateConfigSchema;
type ApiConfig = NotificationsWebhookPluginConfigSchema;

export const WebhookConfigSchema = ConfigPluginSchema.extend({
	// The backend redacts the URL on read and answers with urlConfigured instead, so the stored
	// config has no URL at all. It stays declared because the edit form writes a replacement
	// into it before submitting.
	url: z.string().trim().nullable().optional(),
	urlConfigured: z.boolean().default(false),
	// Same story as `url`, but held as raw JSON text (see `schemas/webhook-headers.schemas.ts`).
	headers: z.string().nullable().optional(),
	headersConfigured: z.boolean().default(false),
	minSeverity: z.enum(['info', 'warning', 'error', 'critical']).default('warning'),
});

// BACKEND API
// ===========

/**
 * Normalises the edit form's raw JSON text into the object the backend's `headers` field
 * expects. Anything that is not a string (an already-parsed object, `null`, `undefined`) is
 * passed straight through, so this also acts as a no-op for a value that never went through
 * the admin's own JSON textarea. Runs as `z.preprocess` rather than `.transform()` so the
 * schema stays assignable to the wire (object-shaped) type this file binds against.
 */
const preprocessHeaders = (value: unknown): unknown => {
	if (typeof value !== 'string') {
		return value;
	}

	const trimmed = value.trim();

	if (trimmed === '') {
		return undefined;
	}

	return isValidHeadersJson(trimmed) ? parseHeadersJson(trimmed) : value;
};

export const WebhookConfigUpdateReqSchema: ZodType<ApiUpdateConfig> = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(NOTIFICATIONS_WEBHOOK_PLUGIN_NAME),
		url: WebhookUrlSchema.nullable().optional(),
		headers: z.preprocess(preprocessHeaders, z.record(z.string(), z.string()).nullable().optional()),
		min_severity: z.nativeEnum(NotificationSeverity).optional(),
	})
);

export const WebhookConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(NOTIFICATIONS_WEBHOOK_PLUGIN_NAME),
		url: WebhookUrlSchema.nullable().optional(),
		url_configured: z.boolean(),
		headers: z.record(z.string(), z.string()).nullable().optional(),
		headers_configured: z.boolean(),
		min_severity: z.nativeEnum(NotificationSeverity),
	})
);
