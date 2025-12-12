import { z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { DEVICES_SHELLY_V1_PLUGIN_NAME } from '../devices-shelly-v1.constants';

export const ShellyV1ConfigSchema = ConfigPluginSchema.extend({
	discovery: z.object({
		enabled: z.boolean(),
		interface: z.string().nullable(),
	}),
	timeouts: z.object({
		requestTimeout: z.number(),
		staleTimeout: z.number(),
	}),
});

// BACKEND API
// ===========

export const ShellyV1ConfigUpdateReqSchema = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_SHELLY_V1_PLUGIN_NAME),
		discovery: z
			.object({
				enabled: z.boolean().optional(),
				interface: z.string().nullable().optional(),
			})
			.optional(),
		timeouts: z
			.object({
				request_timeout: z.number().optional(),
				stale_timeout: z.number().optional(),
			})
			.optional(),
	})
);

export const ShellyV1ConfigResSchema = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(DEVICES_SHELLY_V1_PLUGIN_NAME),
		discovery: z.object({
			enabled: z.boolean(),
			interface: z.string().nullable(),
		}),
		timeouts: z.object({
			request_timeout: z.number(),
			stale_timeout: z.number(),
		}),
	})
);
