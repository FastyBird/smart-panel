import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { DevicesShellyNgPluginShellyNgDeviceType, type components } from '../../../openapi';

type ApiUpdateConfig = components['schemas']['DevicesShellyNgPluginUpdateConfig'];
type ApiConfig = components['schemas']['DevicesShellyNgPluginConfig'];

export const ShellyNgConfigSchema = ConfigPluginSchema.extend({
	mdns: z.object({
		enabled: z.boolean(),
		interface: z.string().nullable(),
	}),
	websockets: z.object({
		requestTimeout: z.number(),
		pingInterval: z.number(),
		reconnectInterval: z.array(z.number()),
	}),
});

// BACKEND API
// ===========

export const ShellyNgConfigUpdateReqSchema: ZodType<ApiUpdateConfig> = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.nativeEnum(DevicesShellyNgPluginShellyNgDeviceType),
		mdns: z
			.object({
				enabled: z.boolean().optional(),
				interface: z.string().nullable().optional(),
			})
			.optional(),
		websockets: z
			.object({
				request_timeout: z.number().optional(),
				ping_interval: z.number().optional(),
				reconnect_interval: z.array(z.number()).optional(),
			})
			.optional(),
	})
);

export const ShellyNgConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.nativeEnum(DevicesShellyNgPluginShellyNgDeviceType),
		mdns: z.object({
			enabled: z.boolean(),
			interface: z.string().nullable(),
		}),
		websockets: z.object({
			request_timeout: z.number(),
			ping_interval: z.number(),
			reconnect_interval: z.array(z.number()),
		}),
	})
);
