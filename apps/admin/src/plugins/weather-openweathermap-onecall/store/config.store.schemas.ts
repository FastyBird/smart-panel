import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { WeatherOpenweathermapPluginDataConfigUnit } from '../../../openapi';
import { WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME } from '../weather-openweathermap-onecall.constants';

export const OpenWeatherMapOneCallConfigSchema = ConfigPluginSchema.extend({
	apiKey: z.string().trim().nullable(),
	unit: z.nativeEnum(WeatherOpenweathermapPluginDataConfigUnit).default(WeatherOpenweathermapPluginDataConfigUnit.celsius),
});

// BACKEND API
// ===========

export const OpenWeatherMapOneCallConfigUpdateReqSchema: ZodType = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME),
		api_key: z.string().trim().nullable().optional(),
		unit: z.nativeEnum(WeatherOpenweathermapPluginDataConfigUnit).optional(),
	})
);

export const OpenWeatherMapOneCallConfigResSchema: ZodType = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME),
		api_key: z.string().trim().nullable(),
		unit: z.nativeEnum(WeatherOpenweathermapPluginDataConfigUnit),
	})
);
