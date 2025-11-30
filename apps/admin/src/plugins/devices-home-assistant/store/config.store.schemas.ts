import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { DevicesHomeAssistantPluginHomeAssistantDeviceType, type components } from '../../../openapi';

type ApiUpdateConfig = components['schemas']['DevicesHomeAssistantPluginUpdateConfig'];
type ApiConfig = components['schemas']['DevicesHomeAssistantPluginDataConfig'];

export const HomeAssistantConfigSchema = ConfigPluginSchema.extend({
	apiKey: z.string().trim().nonempty().nullable(),
	hostname: z.string().trim().nonempty(),
});

// BACKEND API
// ===========

export const HomeAssistantConfigUpdateReqSchema: ZodType<ApiUpdateConfig> = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.nativeEnum(DevicesHomeAssistantPluginHomeAssistantDeviceType),
		api_key: z.string().trim().nonempty().nullable().optional(),
		hostname: z.string().trim().nonempty().optional(),
	})
);

export const HomeAssistantConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.nativeEnum(DevicesHomeAssistantPluginHomeAssistantDeviceType),
		api_key: z.string().trim().nonempty().nullable(),
		hostname: z.string().trim().nonempty(),
	})
);
