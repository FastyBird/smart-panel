import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IConfigPlugin } from '../store/config-plugins.store.types';
import { configPluginsStoreKey } from '../store/keys';

import type { IUseConfigPlugins } from './types';

export const useConfigPlugins = (): IUseConfigPlugins => {
	const storesManager = injectStoresManager();

	const configPluginStore = storesManager.getStore(configPluginsStoreKey);

	const { firstLoad, semaphore } = storeToRefs(configPluginStore);

	const configPlugins = computed<IConfigPlugin[]>((): IConfigPlugin[] => {
		return configPluginStore.findAll();
	});

	const fetchConfigPlugins = async (force: boolean = false): Promise<void> => {
		if (loaded.value || !force) {
			return;
		}

		await configPluginStore.fetch();
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

	const enabled = (type: IConfigPlugin['type']): boolean => {
		const plugin = configPluginStore.findByType(type);

		return plugin?.enabled ?? false;
	};

	return {
		configPlugins,
		areLoading,
		loaded,
		enabled,
		fetchConfigPlugins,
	};
};
