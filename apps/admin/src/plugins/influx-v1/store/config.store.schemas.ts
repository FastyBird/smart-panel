import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { INFLUX_V1_PLUGIN_NAME } from '../influx-v1.constants';

type ApiUpdateConfig = {
	type: typeof INFLUX_V1_PLUGIN_NAME;
	enabled?: boolean;
	host?: string;
	database?: string;
	username?: string;
	password?: string;
};

type ApiConfig = {
	type: typeof INFLUX_V1_PLUGIN_NAME;
	enabled: boolean;
	host: string;
	database: string;
	username?: string;
	password?: string;
};

export const InfluxV1ConfigSchema = ConfigPluginSchema.extend({
	host: z.string(),
	database: z.string(),
	username: z.string().optional(),
	password: z.string().optional(),
});

// BACKEND API
// ===========

export const InfluxV1ConfigUpdateReqSchema: ZodType<ApiUpdateConfig> = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(INFLUX_V1_PLUGIN_NAME),
		host: z.string().optional(),
		database: z.string().optional(),
		username: z.string().optional(),
		password: z.string().optional(),
	})
);

export const InfluxV1ConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(INFLUX_V1_PLUGIN_NAME),
		host: z.string(),
		database: z.string(),
		username: z.string().optional(),
		password: z.string().optional(),
	})
);
