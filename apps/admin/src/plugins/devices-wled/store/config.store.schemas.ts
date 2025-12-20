import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import type { DevicesWledPluginUpdateConfigSchema, DevicesWledPluginConfigSchema } from '../../../openapi.constants';
import { DEVICES_WLED_PLUGIN_NAME } from '../devices-wled.constants';

type ApiUpdateConfig = DevicesWledPluginUpdateConfigSchema;
type ApiConfig = DevicesWledPluginConfigSchema;

export const WledConfigSchema = ConfigPluginSchema.extend({
	timeouts: z.object({
		connectionTimeout: z.number(),
		commandDebounce: z.number(),
	}),
	polling: z.object({
		interval: z.number(),
	}),
	mdns: z.object({
		enabled: z.boolean(),
		interface: z.string().nullable(),
		autoAdd: z.boolean(),
	}),
	websocket: z.object({
		enabled: z.boolean(),
		reconnectInterval: z.number(),
	}),
});

// BACKEND API
// ===========

export const WledConfigUpdateReqSchema: ZodType<ApiUpdateConfig> = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_WLED_PLUGIN_NAME),
		timeouts: z
			.object({
				connection_timeout: z.number().optional(),
				command_debounce: z.number().optional(),
			})
			.optional(),
		polling: z
			.object({
				interval: z.number().optional(),
			})
			.optional(),
		mdns: z
			.object({
				enabled: z.boolean().optional(),
				interface: z.string().nullable().optional(),
				auto_add: z.boolean().optional(),
			})
			.optional(),
		websocket: z
			.object({
				enabled: z.boolean().optional(),
				reconnect_interval: z.number().optional(),
			})
			.optional(),
	})
);

export const WledConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(DEVICES_WLED_PLUGIN_NAME),
		timeouts: z.object({
			connection_timeout: z.number(),
			command_debounce: z.number(),
		}),
		polling: z.object({
			interval: z.number(),
		}),
		mdns: z.object({
			enabled: z.boolean(),
			interface: z.string().nullable(),
			auto_add: z.boolean(),
		}),
		websocket: z.object({
			enabled: z.boolean(),
			reconnect_interval: z.number(),
		}),
	})
);
