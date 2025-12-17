import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';
import { WeatherOpenweathermapPluginDataConfigUnit } from '../../../openapi';

export const OpenWeatherMapOneCallConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	apiKey: z.string().nullable(),
	unit: z.nativeEnum(WeatherOpenweathermapPluginDataConfigUnit),
});
