import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { TemperatureUnit, WEATHER_OPENWEATHERMAP_PLUGIN_NAME } from '../weather-openweathermap.constants';

export const OpenWeatherMapConfigSchema = ConfigPluginSchema.extend({
	apiKey: z.string().trim().nullable(),
	unit: z.nativeEnum(TemperatureUnit).default(TemperatureUnit.CELSIUS),
});

// BACKEND API
// ===========

export const OpenWeatherMapConfigUpdateReqSchema: ZodType = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(WEATHER_OPENWEATHERMAP_PLUGIN_NAME),
		api_key: z.string().trim().nullable().optional(),
		unit: z.nativeEnum(TemperatureUnit).optional(),
	})
);

export const OpenWeatherMapConfigResSchema: ZodType = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(WEATHER_OPENWEATHERMAP_PLUGIN_NAME),
		api_key: z.string().trim().nullable(),
		unit: z.nativeEnum(TemperatureUnit),
	})
);
