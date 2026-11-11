import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IAutomation } from '../store/automations.store.types';
import { automationsStoreKey } from '../store/keys';

import type { IUseAutomations } from './types';

export const useAutomations = (): IUseAutomations => {
	const storesManager = injectStoresManager();

	const automationsStore = storesManager.getStore(automationsStoreKey);

	const { firstLoad, semaphore } = storeToRefs(automationsStore);

	const automations = computed<IAutomation[]>((): IAutomation[] => {
		return automationsStore.findAll().sort((a, b) => a.name.localeCompare(b.name));
	});

	const fetchAutomations = async (): Promise<void> => {
		await automationsStore.fetch();
	};

	const areLoading = computed<boolean>((): boolean => {
		return semaphore.value.fetching.items || !firstLoad.value;
	});

	const loaded = computed<boolean>((): boolean => {
		return firstLoad.value;
	});

	return {
		automations,
		areLoading,
		loaded,
		fetchAutomations,
	};
};
