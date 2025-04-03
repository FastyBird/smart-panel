import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { type IConfigDisplay, configDisplayStoreKey } from '../store';

import type { IUseConfigDisplay } from './types';

export const useConfigDisplay = (): IUseConfigDisplay => {
	const storesManager = injectStoresManager();

	const configDisplayStore = storesManager.getStore(configDisplayStoreKey);

	const { data, semaphore } = storeToRefs(configDisplayStore);

	const configDisplay = computed<IConfigDisplay | null>((): IConfigDisplay | null => {
		return data.value;
	});

	const fetchConfigDisplay = async (): Promise<void> => {
		await configDisplayStore.get();
	};

	const isLoading = computed<boolean>((): boolean => {
		if (data.value !== null) {
			return false;
		}

		return semaphore.value.getting;
	});

	return {
		configDisplay,
		isLoading,
		fetchConfigDisplay,
	};
};
