import { computed, type ComputedRef } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { weatherLocationsStoreKey } from '../store/keys';
import type { IWeatherLocation } from '../store/locations.store.types';

import type { IUseWeatherLocation } from './types';

interface IUseLocationProps {
	id: ComputedRef<IWeatherLocation['id']>;
}

export const useLocation = ({ id }: IUseLocationProps): IUseWeatherLocation => {
	const storesManager = injectStoresManager();

	const locationsStore = storesManager.getStore(weatherLocationsStoreKey);

	const { semaphore } = storeToRefs(locationsStore);

	const location = computed<IWeatherLocation | null>((): IWeatherLocation | null => {
		const found = locationsStore.findById(id.value);

		return found && !found.draft ? found : null;
	});

	const fetchLocation = async (): Promise<void> => {
		await locationsStore.get({ id: id.value });
	};

	const isLoading = computed<boolean>((): boolean => {
		if (location.value !== null) {
			return false;
		}

		return locationsStore.getting(id.value) || semaphore.value.fetching.items;
	});

	return {
		location,
		isLoading,
		fetchLocation,
	};
};
