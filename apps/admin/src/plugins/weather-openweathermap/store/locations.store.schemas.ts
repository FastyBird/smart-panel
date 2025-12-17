import { z } from 'zod';

import { LocationCreateReqSchema, LocationSchema, LocationUpdateReqSchema } from '../../../modules/weather';
import { WeatherOpenweathermapPluginDataLocationLocation_type } from '../../../openapi';
import { WEATHER_OPENWEATHERMAP_PLUGIN_TYPE } from '../weather-openweathermap.constants';

export const OpenWeatherMapLocationSchema = LocationSchema.extend({
	locationType: z.nativeEnum(WeatherOpenweathermapPluginDataLocationLocation_type),
	latitude: z.number().nullable().optional(),
	longitude: z.number().nullable().optional(),
	cityName: z.string().nullable().optional(),
	countryCode: z.string().nullable().optional(),
	cityId: z.number().nullable().optional(),
	zipCode: z.string().nullable().optional(),
});

// BACKEND API
// ===========

export const OpenWeatherMapLocationCreateReqSchema = LocationCreateReqSchema.and(
	z.object({
		type: z.literal(WEATHER_OPENWEATHERMAP_PLUGIN_TYPE),
		location_type: z.nativeEnum(WeatherOpenweathermapPluginDataLocationLocation_type),
		latitude: z.number().optional(),
		longitude: z.number().optional(),
		city_name: z.string().optional(),
		country_code: z.string().optional(),
		city_id: z.number().optional(),
		zip_code: z.string().optional(),
	})
);

export const OpenWeatherMapLocationUpdateReqSchema = LocationUpdateReqSchema.and(
	z.object({
		type: z.literal(WEATHER_OPENWEATHERMAP_PLUGIN_TYPE),
		location_type: z.nativeEnum(WeatherOpenweathermapPluginDataLocationLocation_type).optional(),
		latitude: z.number().optional(),
		longitude: z.number().optional(),
		city_name: z.string().optional(),
		country_code: z.string().optional(),
		city_id: z.number().optional(),
		zip_code: z.string().optional(),
	})
);
