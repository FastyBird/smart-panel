import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import type { DevicesHomeAssistantPluginConfigSchema, DevicesHomeAssistantPluginUpdateConfigSchema } from '../../../openapi.constants';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME } from '../devices-home-assistant.constants';

type ApiUpdateConfig = DevicesHomeAssistantPluginUpdateConfigSchema;
type ApiConfig = DevicesHomeAssistantPluginConfigSchema;

export const HomeAssistantConfigSchema = ConfigPluginSchema.extend({
	apiKey: z.string().trim().nonempty().nullable(),
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

export const HomeAssistantConfigResSchema = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(DEVICES_HOME_ASSISTANT_PLUGIN_NAME),
		api_key: z.string().trim().nonempty().nullable(),
		hostname: z.string().trim().nonempty(),
		supervisor_mode: z.boolean().default(false),
	})
);
