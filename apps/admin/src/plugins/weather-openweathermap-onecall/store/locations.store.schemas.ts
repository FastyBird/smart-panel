import { z } from 'zod';

import { LocationCreateReqSchema, LocationSchema, LocationUpdateReqSchema } from '../../../modules/weather';
import { WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_TYPE } from '../weather-openweathermap-onecall.constants';

export const OpenWeatherMapOneCallLocationSchema = LocationSchema.extend({
	latitude: z.number(),
	longitude: z.number(),
	countryCode: z.string().nullable().optional(),
});

// BACKEND API
// ===========

export const OpenWeatherMapOneCallLocationCreateReqSchema = LocationCreateReqSchema.and(
	z.object({
		type: z.literal(WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_TYPE),
		latitude: z.number(),
		longitude: z.number(),
		country_code: z.string().optional(),
	})
);

export const OpenWeatherMapOneCallLocationUpdateReqSchema = LocationUpdateReqSchema.and(
	z.object({
		type: z.literal(WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_TYPE),
		latitude: z.number().optional(),
		longitude: z.number().optional(),
		country_code: z.string().optional(),
	})
);
