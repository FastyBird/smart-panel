import { z } from 'zod';

import { WeatherConfigEditFormSchema } from './config.schemas';

export type IWeatherConfigEditForm = z.infer<typeof WeatherConfigEditFormSchema>;
