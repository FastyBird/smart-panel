import { logger, snakeToCamel } from '../../../common';
import { WeatherValidationException } from '../weather.exceptions';

import { WeatherForecastSchema } from './weather-forecast.store.schemas';
import type { IWeatherForecast, IWeatherForecastDayRes } from './weather-forecast.store.types';

export const transformWeatherForecastResponse = (response: IWeatherForecastDayRes[]): IWeatherForecast => {
	const parsed = WeatherForecastSchema.safeParse(response.map((item) => snakeToCamel(item)));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new WeatherValidationException('Failed to validate received weather forecast data.');
	}

	return parsed.data;
};
