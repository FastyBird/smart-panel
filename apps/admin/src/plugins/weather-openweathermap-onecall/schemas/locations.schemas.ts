import { z } from 'zod';

import { LocationAddFormSchema, LocationEditFormSchema } from '../../../modules/weather';

export const OpenWeatherMapOneCallLocationAddFormSchema = LocationAddFormSchema.extend({
	latitude: z.number().min(-90).max(90),
	longitude: z.number().min(-180).max(180),
	countryCode: z.string().nullable().optional(),
});

export const OpenWeatherMapOneCallLocationEditFormSchema = LocationEditFormSchema.extend({
	latitude: z.number().min(-90).max(90).optional(),
	longitude: z.number().min(-180).max(180).optional(),
	countryCode: z.string().nullable().optional(),
});

export type OpenWeatherMapOneCallLocationAddFormSchemaType = z.infer<typeof OpenWeatherMapOneCallLocationAddFormSchema>;
export type OpenWeatherMapOneCallLocationEditFormSchemaType = z.infer<typeof OpenWeatherMapOneCallLocationEditFormSchema>;
