import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import type { DevicesHomeAssistantPluginConfigSchema, DevicesHomeAssistantPluginUpdateConfigSchema } from '../../../openapi.constants';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME } from '../devices-home-assistant.constants';

type ApiConfig = DevicesHomeAssistantPluginConfigSchema;
type ApiUpdateConfig = DevicesHomeAssistantPluginUpdateConfigSchema;

export const HomeAssistantConfigSchema = ConfigPluginSchema.extend({
	// The backend redacts the key on read and answers with apiKeyConfigured
	// instead, so the stored config has no apiKey at all. It stays declared
	// because the edit form writes a replacement into it before submitting.
	apiKey: z.string().trim().nonempty().nullable().optional(),
	apiKeyConfigured: z.boolean().default(false),
	hostname: z.string().trim().nonempty(),
	supervisorMode: z.boolean().default(false),
});

// BACKEND API
// ===========

export const HomeAssistantConfigUpdateReqSchema: ZodType<ApiUpdateConfig> = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_HOME_ASSISTANT_PLUGIN_NAME),
		api_key: z.string().trim().nonempty().nullable().optional(),
		hostname: z.string().trim().nonempty().optional(),
	})
);

export const HomeAssistantConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(DEVICES_HOME_ASSISTANT_PLUGIN_NAME),
		api_key: z.string().trim().nonempty().nullable().optional(),
		api_key_configured: z.boolean(),
		hostname: z.string().trim().nonempty(),
		supervisor_mode: z.boolean().default(false),
	})
);
