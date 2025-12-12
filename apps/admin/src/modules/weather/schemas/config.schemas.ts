import { z } from 'zod';

import { ConfigModuleEditFormSchema } from '../../config';

export const WeatherConfigEditFormSchema = ConfigModuleEditFormSchema.extend({
	primaryLocationId: z.string().uuid().nullable().optional(),
});
