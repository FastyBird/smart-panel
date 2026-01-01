import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { pagesStoreKey } from '../store/keys';
import type { IPage } from '../store/pages.store.types';

import type { IUsePages } from './types';

export const usePages = (): IUsePages => {
	const storesManager = injectStoresManager();

	const pagesStore = storesManager.getStore(pagesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(pagesStore);

	const pages = computed<IPage[]>((): IPage[] => {
		return pagesStore.findAll().filter((page) => !page.draft);
	});

	const fetchPages = async (): Promise<void> => {
		await pagesStore.fetch();
	};

	const areLoading = computed<boolean>((): boolean => {
		return semaphore.value.fetching.items || !firstLoad.value;
	});

	const loaded = computed<boolean>((): boolean => {
		return firstLoad.value;
	});

	return {
		pages,
		areLoading,
		loaded,
		fetchPages,
	};
};
