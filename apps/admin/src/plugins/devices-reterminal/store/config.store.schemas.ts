import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import type { DevicesReTerminalPluginConfigSchema, DevicesReTerminalPluginUpdateConfigSchema } from '../../../openapi.constants';
import { DEVICES_RETERMINAL_PLUGIN_NAME } from '../devices-reterminal.constants';

type ApiUpdateConfig = DevicesReTerminalPluginUpdateConfigSchema;
type ApiConfig = DevicesReTerminalPluginConfigSchema;

export const ReTerminalConfigSchema = ConfigPluginSchema.extend({
	polling: z.object({
		interval: z.number(),
	}),
});

// BACKEND API
// ===========

export const ReTerminalConfigUpdateReqSchema: ZodType<ApiUpdateConfig> = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_RETERMINAL_PLUGIN_NAME),
		polling: z
			.object({
				interval: z.number().optional(),
			})
			.optional(),
	})
);

export const ReTerminalConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(DEVICES_RETERMINAL_PLUGIN_NAME),
		polling: z.object({
			interval: z.number(),
		}),
	})
);
