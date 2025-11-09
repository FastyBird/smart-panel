import type { ComputedRef } from 'vue';

import type { IWeatherDay } from '../store/weather-day.store.types';
import type { IWeatherForecast } from '../store/weather-forecast.store.types';

export interface IUseWeatherDay {
	weatherDay: ComputedRef<IWeatherDay | null>;
	isLoading: ComputedRef<boolean>;
	fetchWeatherDay: () => Promise<void>;
}

export interface IUseWeatherForecast {
	weatherForecast: ComputedRef<IWeatherForecast | null>;
	isLoading: ComputedRef<boolean>;
	fetchWeatherForecast: () => Promise<void>;
}
