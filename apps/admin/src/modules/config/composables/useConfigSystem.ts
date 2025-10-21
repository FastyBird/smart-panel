import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IConfigSystem } from '../store/config-system.store.types';
import { configSystemStoreKey } from '../store/keys';

import type { IUseConfigSystem } from './types';

export const useConfigSystem = (): IUseConfigSystem => {
	const storesManager = injectStoresManager();

	const configSystemStore = storesManager.getStore(configSystemStoreKey);

	const { data, semaphore } = storeToRefs(configSystemStore);

	const configSystem = computed<IConfigSystem | null>((): IConfigSystem | null => {
		return data.value;
	});

	const fetchConfigSystem = async (): Promise<void> => {
		await configSystemStore.get();
	};

	const isLoading = computed<boolean>((): boolean => {
		if (data.value !== null) {
			return false;
		}

		return semaphore.value.getting;
	});

	return {
		configSystem,
		isLoading,
		fetchConfigSystem,
	};
};
