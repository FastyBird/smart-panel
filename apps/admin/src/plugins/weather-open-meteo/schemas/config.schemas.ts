import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';
import { TemperatureUnit } from '../weather-open-meteo.constants';

export const OpenMeteoConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	unit: z.nativeEnum(TemperatureUnit),
});
