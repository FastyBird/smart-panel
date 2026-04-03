import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { INFLUX_V2_PLUGIN_NAME } from '../influx-v2.constants';

type ApiUpdateConfig = {
	type: typeof INFLUX_V2_PLUGIN_NAME;
	enabled?: boolean;
	url?: string;
	token?: string;
	org?: string;
	bucket?: string;
};

type ApiConfig = {
	type: typeof INFLUX_V2_PLUGIN_NAME;
	enabled: boolean;
	url: string;
	org: string;
	bucket: string;
	token?: string;
};

export const InfluxV2ConfigSchema = ConfigPluginSchema.extend({
	url: z.string(),
	org: z.string(),
	bucket: z.string(),
	token: z.string().optional(),
});

// BACKEND API
// ===========

export const InfluxV2ConfigUpdateReqSchema: ZodType<ApiUpdateConfig> = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(INFLUX_V2_PLUGIN_NAME),
		url: z.string().optional(),
		token: z.string().optional(),
		org: z.string().optional(),
		bucket: z.string().optional(),
	})
);

export const InfluxV2ConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(INFLUX_V2_PLUGIN_NAME),
		url: z.string(),
		org: z.string(),
		bucket: z.string(),
		token: z.string().optional(),
	})
);
