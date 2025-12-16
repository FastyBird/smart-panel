import { type ComputedRef, computed, inject } from 'vue';

import { injectStoresManager, useLogger } from '../../../common';
import { discoveredExtensionsStoreKey } from '../store/keys';
import type { IDiscoveredExtension } from '../store/discovered-extensions.store.types';

export interface IUseDiscoveredExtensions {
	extensions: ComputedRef<{ admin?: IDiscoveredExtension; backend?: IDiscoveredExtension }[]>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchExtensions: () => Promise<void>;
}

export const useDiscoveredExtensions = (): IUseDiscoveredExtensions => {
	const logger = useLogger();

	const storesManager = injectStoresManager();
	const store = storesManager?.getStore(discoveredExtensionsStoreKey) ?? inject(discoveredExtensionsStoreKey);

	if (!store) {
		throw new Error('Discovered extensions store is not available. Make sure you have registered the store.');
	}

	const extensions = computed<{ admin?: IDiscoveredExtension; backend?: IDiscoveredExtension }[]>((): { admin?: IDiscoveredExtension; backend?: IDiscoveredExtension }[] => {
		return store.findAll();
	});

	const areLoading = computed<boolean>((): boolean => store.fetching());

	const loaded = computed<boolean>((): boolean => store.firstLoadFinished());

	const fetchExtensions = async (): Promise<void> => {
		try {
			await store.fetch();
		} catch (error) {
			logger.error('Failed to fetch discovered extensions', error);
		}
	};

	return {
		extensions,
		areLoading,
		loaded,
		fetchExtensions,
	};
};
