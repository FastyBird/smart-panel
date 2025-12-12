import { type ZodType, z } from 'zod';

import type {
	ConfigModuleModuleSchema,
	ConfigModuleUpdateModuleSchema,
} from '../../../openapi.constants';
import { ConfigModuleResSchema, ConfigModuleSchema, ConfigModuleUpdateReqSchema } from '../../config/store/config-modules.store.schemas';
import { WEATHER_MODULE_NAME } from '../weather.constants';

type ApiConfigModule = ConfigModuleModuleSchema;
type ApiConfigUpdateModule = ConfigModuleUpdateModuleSchema;

// STORE STATE
// ===========

export const WeatherConfigSchema = ConfigModuleSchema.extend({
	type: z.literal(WEATHER_MODULE_NAME),
	primaryLocationId: z.string().uuid().nullable().optional(),
});

// BACKEND API
// ===========

export const WeatherConfigUpdateReqSchema: ZodType<ApiConfigUpdateModule> = ConfigModuleUpdateReqSchema.and(
	z.object({
		type: z.literal(WEATHER_MODULE_NAME),
		primary_location_id: z.string().uuid().nullable().optional(),
	})
);

export const WeatherConfigResSchema: ZodType<ApiConfigModule> = ConfigModuleResSchema.and(
	z.object({
		type: z.literal(WEATHER_MODULE_NAME),
		primary_location_id: z.string().uuid().nullable().optional(),
	})
);
