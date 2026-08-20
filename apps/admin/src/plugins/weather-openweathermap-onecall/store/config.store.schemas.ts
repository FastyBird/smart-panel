import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import type { WeatherOpenweathermapOnecallPluginConfigSchema } from '../../../openapi.constants';
import { TemperatureUnit, WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME } from '../weather-openweathermap-onecall.constants';

type ApiConfig = WeatherOpenweathermapOnecallPluginConfigSchema;

export const OpenWeatherMapOneCallConfigSchema = ConfigPluginSchema.extend({
	// The backend redacts the key on read and answers with apiKeyConfigured
	// instead, so the stored config has no apiKey at all. It stays declared
	// because the edit form writes a replacement into it before submitting.
	apiKey: z.string().trim().nullable().optional(),
	apiKeyConfigured: z.boolean().default(false),
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
		api_key: z.string().trim().nullable().optional(),
		api_key_configured: z.boolean(),
		unit: z.nativeEnum(TemperatureUnit),
	})
);
