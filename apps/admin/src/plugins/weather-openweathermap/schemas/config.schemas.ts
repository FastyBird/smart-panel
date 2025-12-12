import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';
import { TemperatureUnit } from '../weather-openweathermap.constants';

export const OpenWeatherMapConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	apiKey: z.string().nullable(),
	unit: z.nativeEnum(TemperatureUnit),
});
