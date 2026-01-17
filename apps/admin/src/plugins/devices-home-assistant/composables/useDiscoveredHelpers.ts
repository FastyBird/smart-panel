import { computed } from 'vue';

import { injectStoresManager } from '../../../common';
import type { IHomeAssistantDiscoveredHelper } from '../store/home-assistant-discovered-helpers.store.types';
import { discoveredHelpersStoreKey } from '../store/keys';

import type { IUseDiscoveredHelpers } from './types';

export const useDiscoveredHelpers = (): IUseDiscoveredHelpers => {
	const storesManager = injectStoresManager();

	const helpersStore = storesManager.getStore(discoveredHelpersStoreKey);

	const helpers = computed<IHomeAssistantDiscoveredHelper[]>((): IHomeAssistantDiscoveredHelper[] => helpersStore.findAll());

	const areLoading = computed<boolean>((): boolean => helpersStore.fetching());

	const loaded = computed<boolean>((): boolean => helpersStore.firstLoadFinished());

	const fetchDiscoveredHelpers = async (): Promise<void> => {
		await helpersStore.fetch();
	};

	return {
		helpers,
		areLoading,
		loaded,
		fetchDiscoveredHelpers,
	};
};
