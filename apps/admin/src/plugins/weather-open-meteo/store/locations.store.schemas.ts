import { z } from 'zod';

import { LocationCreateReqSchema, LocationSchema, LocationUpdateReqSchema } from '../../../modules/weather';
import { WEATHER_OPEN_METEO_PLUGIN_TYPE } from '../weather-open-meteo.constants';

export const OpenMeteoLocationSchema = LocationSchema.extend({
	latitude: z.number(),
	longitude: z.number(),
	countryCode: z.string().nullable().optional(),
});

// BACKEND API
// ===========

export const OpenMeteoLocationCreateReqSchema = LocationCreateReqSchema.and(
	z.object({
		type: z.literal(WEATHER_OPEN_METEO_PLUGIN_TYPE),
		latitude: z.number(),
		longitude: z.number(),
		country_code: z.string().optional(),
	})
);

export const OpenMeteoLocationUpdateReqSchema = LocationUpdateReqSchema.and(
	z.object({
		type: z.literal(WEATHER_OPEN_METEO_PLUGIN_TYPE),
		latitude: z.number().optional(),
		longitude: z.number().optional(),
		country_code: z.string().optional(),
	})
);
