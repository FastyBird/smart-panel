import { logger, snakeToCamel } from '../../../common';
import { WeatherValidationException } from '../weather.exceptions';

import { WeatherHourlyForecastSchema } from './weather-hourly-forecast.store.schemas';
import type { IWeatherForecastHourRes, IWeatherHourlyForecast } from './weather-hourly-forecast.store.types';

export const transformWeatherHourlyForecastResponse = (response: IWeatherForecastHourRes[]): IWeatherHourlyForecast => {
	const parsed = WeatherHourlyForecastSchema.safeParse(response.map((item) => snakeToCamel(item)));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new WeatherValidationException('Failed to validate received weather hourly forecast data.');
	}

	return parsed.data;
};
