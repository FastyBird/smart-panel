import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { weatherDayStoreKey } from '../store/keys';
import type { IWeatherDay } from '../store/weather-day.store.types';

import type { IUseWeatherDay } from './types';

export const useWeatherDay = (): IUseWeatherDay => {
	const storesManager = injectStoresManager();

	const weatherDayStore = storesManager.getStore(weatherDayStoreKey);

	const { data, semaphore } = storeToRefs(weatherDayStore);

	const weatherDay = computed<IWeatherDay | null>((): IWeatherDay | null => {
		return data.value;
	});

	const fetchWeatherDay = async (): Promise<void> => {
		await weatherDayStore.get();
	};

	const isLoading = computed<boolean>((): boolean => {
		if (data.value !== null) {
			return false;
		}

		return semaphore.value.getting;
	});

	return {
		weatherDay,
		isLoading,
		fetchWeatherDay,
	};
};
