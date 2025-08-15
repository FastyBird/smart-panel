import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IDisplayInstance } from '../store/displays-instances.store.types';
import { displaysInstancesStoreKey } from '../store/keys';

import type { IUseDisplaysInstances } from './types';

export const useDisplaysInstances = (): IUseDisplaysInstances => {
	const storesManager = injectStoresManager();

	const displaysStore = storesManager.getStore(displaysInstancesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(displaysStore);

	const displays = computed<IDisplayInstance[]>((): IDisplayInstance[] => {
		return displaysStore.findAll().filter((display) => !display.draft);
	});

	const fetchDisplays = async (): Promise<void> => {
		await displaysStore.fetch();
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
		displays,
		areLoading,
		loaded,
		fetchDisplays,
	};
};
