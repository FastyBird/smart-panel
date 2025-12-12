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
	locationType: z.enum(['lat_lon', 'city_name', 'city_id', 'zip_code']),
	unit: z.enum(['celsius', 'fahrenheit']),
	openWeatherApiKey: z.string().nullable().optional(),
	latitude: z.number().min(-90).max(90).nullable().optional(),
	longitude: z.number().min(-180).max(180).nullable().optional(),
	cityName: z.string().nullable().optional(),
	cityId: z.number().int().min(1).nullable().optional(),
	zipCode: z.string().nullable().optional(),
});

// BACKEND API
// ===========

export const WeatherConfigUpdateReqSchema: ZodType<ApiConfigUpdateModule> = ConfigModuleUpdateReqSchema.and(
	z.object({
		type: z.literal(WEATHER_MODULE_NAME),
		location_type: z.enum(['lat_lon', 'city_name', 'city_id', 'zip_code']).optional(),
		unit: z.enum(['celsius', 'fahrenheit']).optional(),
		open_weather_api_key: z.string().nullable().optional(),
		latitude: z.number().min(-90).max(90).nullable().optional(),
		longitude: z.number().min(-180).max(180).nullable().optional(),
		city_name: z.string().nullable().optional(),
		city_id: z.number().int().min(1).nullable().optional(),
		zip_code: z.string().nullable().optional(),
	})
);

export const WeatherConfigResSchema: ZodType<ApiConfigModule> = ConfigModuleResSchema.and(
	z.object({
		type: z.literal(WEATHER_MODULE_NAME),
		location_type: z.enum(['lat_lon', 'city_name', 'city_id', 'zip_code']),
		unit: z.enum(['celsius', 'fahrenheit']),
		open_weather_api_key: z.string().nullable().optional(),
		latitude: z.number().min(-90).max(90).nullable().optional(),
		longitude: z.number().min(-180).max(180).nullable().optional(),
		city_name: z.string().nullable().optional(),
		city_id: z.number().int().min(1).nullable().optional(),
		zip_code: z.string().nullable().optional(),
	})
);
