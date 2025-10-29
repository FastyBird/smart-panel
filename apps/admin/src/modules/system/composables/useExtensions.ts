import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IExtension } from '../store/extensions.store.types';
import { extensionsStoreKey } from '../store/keys';

import type { IUseExtensions } from './types';

export const useExtensions = (): IUseExtensions => {
	const storesManager = injectStoresManager();

	const extensionsStore = storesManager.getStore(extensionsStoreKey);

	const { firstLoad, semaphore } = storeToRefs(extensionsStore);

	const extensions = computed<{ admin?: IExtension; backend?: IExtension }[]>((): { admin?: IExtension; backend?: IExtension }[] => {
		return extensionsStore.findAll();
	});

	const fetchExtensions = async (): Promise<void> => {
		await extensionsStore.fetch();
	};

	const areLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.items) {
			return true;
		}

		if (firstLoad.value) {
			return false;
		}

		return semaphore.value.fetching.items;
	});

	const loaded = computed<boolean>((): boolean => {
		return firstLoad.value;
	});

	return {
		extensions,
		areLoading,
		loaded,
		fetchExtensions,
	};
};
