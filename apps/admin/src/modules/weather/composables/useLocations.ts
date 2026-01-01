import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { weatherLocationsStoreKey } from '../store/keys';
import type { IWeatherLocation } from '../store/locations.store.types';

import type { IUseWeatherLocations } from './types';

export const useLocations = (): IUseWeatherLocations => {
	const storesManager = injectStoresManager();

	const locationsStore = storesManager.getStore(weatherLocationsStoreKey);

	const { firstLoad, semaphore } = storeToRefs(locationsStore);

	const locations = computed<IWeatherLocation[]>((): IWeatherLocation[] => {
		return locationsStore.findAll().filter((location) => !location.draft);
	});

	const fetchLocations = async (): Promise<void> => {
		await locationsStore.fetch();
	};

	const areLoading = computed<boolean>((): boolean => {
		return semaphore.value.fetching.items || !firstLoad.value;
	});

	const loaded = computed<boolean>((): boolean => {
		return firstLoad.value;
	});

	return {
		locations,
		areLoading,
		loaded,
		fetchLocations,
	};
};
