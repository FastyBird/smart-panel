import type { IWeatherHourlyForecast } from '../store/weather-hourly-forecast.store.types';

export interface ILocationHourlyForecastProps {
	hourlyForecast: IWeatherHourlyForecast;
	sunrise?: Date | string | null;
	sunset?: Date | string | null;
}
