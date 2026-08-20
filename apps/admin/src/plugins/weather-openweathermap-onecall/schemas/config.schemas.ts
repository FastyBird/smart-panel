import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';
import { TemperatureUnit } from '../weather-openweathermap-onecall.constants';

export const OpenWeatherMapOneCallConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	// Empty means "keep the stored key" - the backend never sends it back.
	apiKey: z.string().nullable().optional(),
	unit: z.nativeEnum(TemperatureUnit),
});
