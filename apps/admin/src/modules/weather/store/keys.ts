import type { StoreInjectionKey } from '../../../common';

import type { IWeatherDayStoreActions, IWeatherDayStoreState } from './weather-day.store.types';
import type { IWeatherForecastStoreActions, IWeatherForecastStoreState } from './weather-forecast.store.types';

export const weatherDayStoreKey: StoreInjectionKey<string, IWeatherDayStoreState, object, IWeatherDayStoreActions> =
	Symbol('FB-Module-Weather-WeatherDay');

export const weatherForecastStoreKey: StoreInjectionKey<string, IWeatherForecastStoreState, object, IWeatherForecastStoreActions> =
	Symbol('FB-Module-Weather-WeatherForecast');
