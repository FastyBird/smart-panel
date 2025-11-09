import { logger, snakeToCamel } from '../../../common';
import { WeatherValidationException } from '../weather.exceptions';

import { WeatherDaySchema } from './weather-day.store.schemas';
import type { IWeatherDay, IWeatherDayRes } from './weather-day.store.types';

export const transformWeatherDayResponse = (response: IWeatherDayRes): IWeatherDay => {
	const parsed = WeatherDaySchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new WeatherValidationException('Failed to validate received weather day data.');
	}

	return parsed.data;
};
