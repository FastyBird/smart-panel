import { z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { TemperatureUnit, WEATHER_OPEN_METEO_PLUGIN_NAME } from '../weather-open-meteo.constants';

export const OpenMeteoConfigSchema = ConfigPluginSchema.extend({
	unit: z.nativeEnum(TemperatureUnit).default(TemperatureUnit.CELSIUS),
});

// BACKEND API
// ===========

export const OpenMeteoConfigUpdateReqSchema = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(WEATHER_OPEN_METEO_PLUGIN_NAME),
		unit: z.nativeEnum(TemperatureUnit).optional(),
	})
);

export const OpenMeteoConfigResSchema = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(WEATHER_OPEN_METEO_PLUGIN_NAME),
		unit: z.nativeEnum(TemperatureUnit),
	})
);
