import { z } from 'zod';

import { WeatherTileEditFormSchema } from './tiles.schemas';

export type IWeatherTileEditForm = z.infer<typeof WeatherTileEditFormSchema>;
