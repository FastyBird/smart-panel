import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { type IConfigWeather, configWeatherStoreKey } from '../store';

import type { IUseConfigWeather } from './types';

export const useConfigWeather = (): IUseConfigWeather => {
	const storesManager = injectStoresManager();

	const configWeatherStore = storesManager.getStore(configWeatherStoreKey);

	const { data, semaphore } = storeToRefs(configWeatherStore);

	const configWeather = computed<IConfigWeather | null>((): IConfigWeather | null => {
		return data.value;
	});

	const fetchConfigWeather = async (): Promise<void> => {
		await configWeatherStore.get();
	};

	const isLoading = computed<boolean>((): boolean => {
		if (data.value !== null) {
			return false;
		}

		return semaphore.value.getting;
	});

	return {
		configWeather,
		isLoading,
		fetchConfigWeather,
	};
};
