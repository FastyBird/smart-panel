import { z } from 'zod';

import { ConfigModuleEditFormSchema } from '../../config';

export const WeatherConfigEditFormSchema = ConfigModuleEditFormSchema.extend({
	locationType: z.enum(['lat_lon', 'city_name', 'city_id', 'zip_code']),
	unit: z.enum(['celsius', 'fahrenheit']),
	openWeatherApiKey: z.string().nullable().optional(),
	latitude: z.number().min(-90).max(90).nullable().optional(),
	longitude: z.number().min(-180).max(180).nullable().optional(),
	cityName: z.string().nullable().optional(),
	cityId: z.number().int().min(1).nullable().optional(),
	zipCode: z.string().nullable().optional(),
});
