import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IConfigApp } from '../store/config-app.store.types';
import { configAppStoreKey } from '../store/keys';

import type { IUseConfigApp } from './types';

export const useConfigApp = (): IUseConfigApp => {
	const storesManager = injectStoresManager();

	const configAppStore = storesManager.getStore(configAppStoreKey);

	const { data, semaphore } = storeToRefs(configAppStore);

	const configApp = computed<IConfigApp | null>((): IConfigApp | null => {
		return data.value;
	});

	const fetchConfigApp = async (): Promise<void> => {
		await configAppStore.get();
	};

	const isLoading = computed<boolean>((): boolean => {
		if (data.value !== null) {
			return false;
		}

		return semaphore.value.getting;
	});

	return {
		configApp,
		isLoading,
		fetchConfigApp,
	};
};
