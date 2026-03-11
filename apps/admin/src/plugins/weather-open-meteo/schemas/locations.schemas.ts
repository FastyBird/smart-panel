import { z } from 'zod';

import { LocationAddFormSchema, LocationEditFormSchema } from '../../../modules/weather';

export const OpenMeteoLocationAddFormSchema = LocationAddFormSchema.extend({
	latitude: z.number().min(-90).max(90),
	longitude: z.number().min(-180).max(180),
	countryCode: z.string().nullable().optional(),
});

export const OpenMeteoLocationEditFormSchema = LocationEditFormSchema.extend({
	latitude: z.number().min(-90).max(90).optional(),
	longitude: z.number().min(-180).max(180).optional(),
	countryCode: z.string().nullable().optional(),
});

export type OpenMeteoLocationAddFormSchemaType = z.infer<typeof OpenMeteoLocationAddFormSchema>;
export type OpenMeteoLocationEditFormSchemaType = z.infer<typeof OpenMeteoLocationEditFormSchema>;
