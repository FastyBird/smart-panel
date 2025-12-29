import { computed } from 'vue';

import { injectStoresManager } from '../../../common';
import { discoveredHelpersStoreKey } from '../store/keys';
import type { IHomeAssistantDiscoveredHelper } from '../store/home-assistant-discovered-helpers.store.types';

import type { IUseDiscoveredHelpers } from './types';

export const useDiscoveredHelpers = (): IUseDiscoveredHelpers => {
	const storesManager = injectStoresManager();

	const helpersStore = storesManager.getStore(discoveredHelpersStoreKey);

	const helpers = computed<IHomeAssistantDiscoveredHelper[]>((): IHomeAssistantDiscoveredHelper[] => helpersStore.findAll());

	const areLoading = computed<boolean>((): boolean => helpersStore.fetching());

	const fetchDiscoveredHelpers = async (): Promise<void> => {
		await helpersStore.fetch();
	};

	return {
		helpers,
		areLoading,
		fetchDiscoveredHelpers,
	};
};
