import { z } from 'zod';

import { LocationAddFormSchema, LocationEditFormSchema } from '../../../modules/weather';
import { WeatherOpenweathermapPluginDataLocationLocation_type } from '../../../openapi';

export const OpenWeatherMapLocationAddFormSchema = LocationAddFormSchema.extend({
	locationType: z.nativeEnum(WeatherOpenweathermapPluginDataLocationLocation_type),
	latitude: z.number().min(-90).max(90).nullable().optional(),
	longitude: z.number().min(-180).max(180).nullable().optional(),
	cityName: z.string().nullable().optional(),
	countryCode: z.string().nullable().optional(),
	cityId: z.number().nullable().optional(),
	zipCode: z.string().nullable().optional(),
});

export const OpenWeatherMapLocationEditFormSchema = LocationEditFormSchema.extend({
	locationType: z.nativeEnum(WeatherOpenweathermapPluginDataLocationLocation_type).optional(),
	latitude: z.number().min(-90).max(90).nullable().optional(),
	longitude: z.number().min(-180).max(180).nullable().optional(),
	cityName: z.string().nullable().optional(),
	countryCode: z.string().nullable().optional(),
	cityId: z.number().nullable().optional(),
	zipCode: z.string().nullable().optional(),
});

export type OpenWeatherMapLocationAddFormSchemaType = z.infer<typeof OpenWeatherMapLocationAddFormSchema>;
export type OpenWeatherMapLocationEditFormSchemaType = z.infer<typeof OpenWeatherMapLocationEditFormSchema>;
