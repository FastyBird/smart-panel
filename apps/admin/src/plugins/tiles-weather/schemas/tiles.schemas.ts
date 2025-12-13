import { z } from 'zod';

import { TileEditFormSchema } from '../../../modules/dashboard';

export const WeatherTileEditFormSchema = TileEditFormSchema.extend({
	locationId: z.string().uuid().optional().nullable(),
});
