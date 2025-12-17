import { z } from 'zod';

import { TileAddFormSchema, TileEditFormSchema } from '../../../modules/dashboard';

export const WeatherTileAddFormSchema = TileAddFormSchema.extend({
	locationId: z.string().uuid().optional().nullable(),
});

export const WeatherTileEditFormSchema = TileEditFormSchema.extend({
	locationId: z.string().uuid().optional().nullable(),
});
