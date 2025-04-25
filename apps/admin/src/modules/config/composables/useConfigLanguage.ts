import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IConfigLanguage } from '../store/config-language.store.types';
import { configLanguageStoreKey } from '../store/keys';

import type { IUseConfigLanguage } from './types';

export const useConfigLanguage = (): IUseConfigLanguage => {
	const storesManager = injectStoresManager();

	const configLanguageStore = storesManager.getStore(configLanguageStoreKey);

	const { data, semaphore } = storeToRefs(configLanguageStore);

	const configLanguage = computed<IConfigLanguage | null>((): IConfigLanguage | null => {
		return data.value;
	});

	const fetchConfigLanguage = async (): Promise<void> => {
		await configLanguageStore.get();
	};

	const isLoading = computed<boolean>((): boolean => {
		if (data.value !== null) {
			return false;
		}

		return semaphore.value.getting;
	});

	return {
		configLanguage,
		isLoading,
		fetchConfigLanguage,
	};
};
