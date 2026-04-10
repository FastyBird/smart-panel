import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import type { WeatherOpenweathermapOnecallPluginConfigSchema } from '../../../openapi.constants';
import { TemperatureUnit, WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME } from '../weather-openweathermap-onecall.constants';

type ApiConfig = WeatherOpenweathermapOnecallPluginConfigSchema;

export const OpenWeatherMapOneCallConfigSchema = ConfigPluginSchema.extend({
	apiKey: z.string().trim().nullable(),
	unit: z.nativeEnum(TemperatureUnit).default(TemperatureUnit.celsius),
});

// BACKEND API
// ===========

export const OpenWeatherMapOneCallConfigUpdateReqSchema= ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME),
		api_key: z.string().trim().nullable().optional(),
		unit: z.nativeEnum(TemperatureUnit).optional(),
	})
);

export const OpenWeatherMapOneCallConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME),
		api_key: z.string().trim().nullable(),
		unit: z.nativeEnum(TemperatureUnit),
	})
);
