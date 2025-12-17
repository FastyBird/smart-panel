import type { z } from 'zod';

import type { OpenWeatherMapConfigEditFormSchema } from './config.schemas';

export type IOpenWeatherMapConfigEditForm = z.infer<typeof OpenWeatherMapConfigEditFormSchema>;
