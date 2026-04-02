import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { INFLUX_V1_PLUGIN_NAME } from '../influx-v1.constants';

type ApiUpdateConfig = {
	type: typeof INFLUX_V1_PLUGIN_NAME;
	enabled?: boolean;
	host?: string | null;
	database?: string | null;
	username?: string | null;
	password?: string | null;
};

type ApiConfig = {
	type: typeof INFLUX_V1_PLUGIN_NAME;
	enabled: boolean;
	host: string | null;
	database: string | null;
	username?: string | null;
	password?: string | null;
};

export const InfluxV1ConfigSchema = ConfigPluginSchema.extend({
	host: z.string().nullable(),
	database: z.string().nullable(),
	username: z.string().nullable().optional(),
	password: z.string().nullable().optional(),
});

// BACKEND API
// ===========

export const InfluxV1ConfigUpdateReqSchema: ZodType<ApiUpdateConfig> = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(INFLUX_V1_PLUGIN_NAME),
		host: z.string().nullable().optional(),
		database: z.string().nullable().optional(),
		username: z.string().nullable().optional(),
		password: z.string().nullable().optional(),
	})
);

export const InfluxV1ConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(INFLUX_V1_PLUGIN_NAME),
		host: z.string().nullable(),
		database: z.string().nullable(),
		username: z.string().nullable().optional(),
		password: z.string().nullable().optional(),
	})
);
