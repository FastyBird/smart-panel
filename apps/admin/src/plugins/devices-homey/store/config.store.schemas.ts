import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import type { DevicesHomeyPluginConfigSchema, DevicesHomeyPluginUpdateConfigSchema } from '../../../openapi.constants';
import { DevicesHomeyPluginConnectionMode } from '../../../openapi.constants';
import { DEVICES_HOMEY_PLUGIN_NAME } from '../devices-homey.constants';
import { HomeyUrlSchema } from '../schemas/homey-url.schemas';

export const HomeyConfigSchema = ConfigPluginSchema.extend({
	mode: z.nativeEnum(DevicesHomeyPluginConnectionMode).default(DevicesHomeyPluginConnectionMode.local),
	url: HomeyUrlSchema.nullable().optional(),
	apiKey: z.string().trim().min(1).nullable().optional(),
	apiKeyConfigured: z.boolean().default(false),
	cloudClientId: z.string().trim().min(1).nullable().optional(),
	cloudClientSecret: z.string().trim().min(1).nullable().optional(),
	cloudClientSecretConfigured: z.boolean().default(false),
	cloudRedirectUrl: z.string().trim().min(1).nullable().optional(),
	connectionTimeout: z.number().int().positive(),
	reconciliationInterval: z.number().int().positive(),
});

export const HomeyConfigUpdateReqSchema: ZodType<DevicesHomeyPluginUpdateConfigSchema> = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_HOMEY_PLUGIN_NAME),
		mode: z.nativeEnum(DevicesHomeyPluginConnectionMode).optional(),
		url: HomeyUrlSchema.nullable().optional(),
		api_key: z.string().trim().min(1).nullable().optional(),
		cloud_client_id: z.string().trim().min(1).nullable().optional(),
		cloud_client_secret: z.string().trim().min(1).nullable().optional(),
		cloud_redirect_url: z.string().trim().min(1).nullable().optional(),
		connection_timeout: z.number().int().positive().optional(),
		reconciliation_interval: z.number().int().positive().optional(),
	})
);

export const HomeyConfigResSchema: ZodType<DevicesHomeyPluginConfigSchema> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(DEVICES_HOMEY_PLUGIN_NAME),
		mode: z.nativeEnum(DevicesHomeyPluginConnectionMode),
		url: HomeyUrlSchema.nullable().optional(),
		api_key: z.string().trim().min(1).nullable().optional(),
		api_key_configured: z.boolean(),
		cloud_client_id: z.string().trim().min(1).nullable().optional(),
		cloud_client_secret: z.string().trim().min(1).nullable().optional(),
		cloud_client_secret_configured: z.boolean(),
		cloud_redirect_url: z.string().trim().min(1).nullable().optional(),
		connection_timeout: z.number().int().positive(),
		reconciliation_interval: z.number().int().positive(),
	})
);
