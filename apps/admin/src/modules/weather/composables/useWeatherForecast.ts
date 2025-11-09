import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { weatherForecastStoreKey } from '../store/keys';
import type { IWeatherForecast } from '../store/weather-forecast.store.types';

import type { IUseWeatherForecast } from './types';

export const useWeatherForecast = (): IUseWeatherForecast => {
	const storesManager = injectStoresManager();

	const weatherForecastStore = storesManager.getStore(weatherForecastStoreKey);

	const { data, semaphore } = storeToRefs(weatherForecastStore);

	const weatherForecast = computed<IWeatherForecast | null>((): IWeatherForecast | null => {
		return data.value;
	});

	const fetchWeatherForecast = async (): Promise<void> => {
		await weatherForecastStore.get();
	};

	const isLoading = computed<boolean>((): boolean => {
		if (data.value !== null) {
			return false;
		}

		return semaphore.value.getting;
	});

	return {
		weatherForecast,
		isLoading,
		fetchWeatherForecast,
	};
};
