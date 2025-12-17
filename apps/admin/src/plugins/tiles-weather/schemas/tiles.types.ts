import { z } from 'zod';

import { WeatherTileAddFormSchema, WeatherTileEditFormSchema } from './tiles.schemas';

export type IWeatherTileAddForm = z.infer<typeof WeatherTileAddFormSchema>;
export type IWeatherTileEditForm = z.infer<typeof WeatherTileEditFormSchema>;
