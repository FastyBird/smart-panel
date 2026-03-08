import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';
import { TemperatureUnit } from '../weather-openweathermap-onecall.constants';

export const OpenWeatherMapOneCallConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	apiKey: z.string().nullable(),
	unit: z.nativeEnum(TemperatureUnit),
});
