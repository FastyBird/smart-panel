import { type ZodType, z } from 'zod';

import type {
	ConfigModuleModuleSchema,
	ConfigModuleUpdateModuleSchema,
} from '../../../openapi.constants';
import { ConfigModuleResSchema, ConfigModuleSchema, ConfigModuleUpdateReqSchema } from '../../config/store/config-modules.store.schemas';
import { INFLUXDB_MODULE_NAME } from '../influxdb.constants';

type ApiConfigModule = ConfigModuleModuleSchema;
type ApiConfigUpdateModule = ConfigModuleUpdateModuleSchema;

// STORE STATE
// ===========

export const InfluxDbConfigSchema = ConfigModuleSchema.extend({
	type: z.literal(INFLUXDB_MODULE_NAME),
	host: z.string(),
	database: z.string(),
	username: z.string().optional(),
	password: z.string().optional(),
});

// BACKEND API
// ===========

export const InfluxDbConfigUpdateReqSchema: ZodType<ApiConfigUpdateModule> = ConfigModuleUpdateReqSchema.and(
	z.object({
		type: z.literal(INFLUXDB_MODULE_NAME),
		host: z.string().optional(),
		database: z.string().optional(),
		username: z.string().optional(),
		password: z.string().optional(),
	})
);

export const InfluxDbConfigResSchema: ZodType<ApiConfigModule> = ConfigModuleResSchema.and(
	z.object({
		type: z.literal(INFLUXDB_MODULE_NAME),
		host: z.string(),
		database: z.string(),
		username: z.string().optional(),
		password: z.string().optional(),
	})
);
