import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import type { WeatherOpenweathermapPluginConfigSchema } from '../../../openapi.constants';
import { WeatherTemperatureUnit } from '../../../openapi.constants';
import { TemperatureUnit, WEATHER_OPENWEATHERMAP_PLUGIN_NAME } from '../weather-openweathermap.constants';

type ApiConfig = WeatherOpenweathermapPluginConfigSchema;

export const OpenWeatherMapConfigSchema = ConfigPluginSchema.extend({
	apiKey: z.string().trim().nullable(),
	unit: z.nativeEnum(TemperatureUnit).default(TemperatureUnit.CELSIUS),
});

// BACKEND API
// ===========

export const OpenWeatherMapConfigUpdateReqSchema= ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(WEATHER_OPENWEATHERMAP_PLUGIN_NAME),
		api_key: z.string().trim().nullable().optional(),
		unit: z.nativeEnum(TemperatureUnit).optional(),
	})
);

export const OpenWeatherMapConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(WEATHER_OPENWEATHERMAP_PLUGIN_NAME),
		api_key: z.string().trim().nullable(),
		unit: z.nativeEnum(WeatherTemperatureUnit),
	})
);
