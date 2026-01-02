import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IHomeAssistantState } from '../store/home-assistant-states.store.types';
import { statesStoreKey } from '../store/keys';

import type { IUseStates } from './types';

export const useStates = (): IUseStates => {
	const storesManager = injectStoresManager();

	const statesStore = storesManager.getStore(statesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(statesStore);

	const states = computed<IHomeAssistantState[]>((): IHomeAssistantState[] => {
		return statesStore.findAll();
	});

	const fetchStates = async (): Promise<void> => {
		await statesStore.fetch();
	};

	const areLoading = computed<boolean>((): boolean => {
		return !!semaphore.value.fetching.items || !firstLoad.value;
	});

	const loaded = computed<boolean>((): boolean => {
		return firstLoad.value;
	});

	return {
		states,
		areLoading,
		loaded,
		fetchStates,
	};
};
