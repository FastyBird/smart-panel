import type { StoreInjectionKey } from '../../../common';

import type { IWeatherLocationsStoreActions, IWeatherLocationsStoreState } from './locations.store.types';
import type { IWeatherDayStoreActions, IWeatherDayStoreState } from './weather-day.store.types';
import type { IWeatherForecastStoreActions, IWeatherForecastStoreState } from './weather-forecast.store.types';

export const weatherLocationsStoreKey: StoreInjectionKey<string, IWeatherLocationsStoreState, object, IWeatherLocationsStoreActions> =
	Symbol('FB-Module-Weather-Locations');

export const weatherDayStoreKey: StoreInjectionKey<string, IWeatherDayStoreState, object, IWeatherDayStoreActions> =
	Symbol('FB-Module-Weather-WeatherDay');

export const weatherForecastStoreKey: StoreInjectionKey<string, IWeatherForecastStoreState, object, IWeatherForecastStoreActions> =
	Symbol('FB-Module-Weather-WeatherForecast');
