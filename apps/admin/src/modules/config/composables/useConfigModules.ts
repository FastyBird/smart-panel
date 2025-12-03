import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IConfigModule } from '../store/config-modules.store.types';
import { configModulesStoreKey } from '../store/keys';

import type { IUseConfigModules } from './types';

export const useConfigModules = (): IUseConfigModules => {
	const storesManager = injectStoresManager();

	const configModulesStore = storesManager.getStore(configModulesStoreKey);

	const { semaphore } = storeToRefs(configModulesStore);

	const configModules = computed<IConfigModule[]>((): IConfigModule[] => {
		return configModulesStore.findAll();
	});

	const areLoading = computed<boolean>((): boolean => {
		return semaphore.value.fetching.items;
	});

	const loaded = computed<boolean>((): boolean => {
		return configModulesStore.firstLoadFinished();
	});

	const enabled = (type: IConfigModule['type']): boolean => {
		const module = configModulesStore.findByType(type);

		return module?.enabled ?? false;
	};

	const fetchConfigModules = async (force = false): Promise<void> => {
		if (force || !loaded.value) {
			await configModulesStore.fetch();
		}
	};

	return {
		configModules,
		areLoading,
		loaded,
		enabled,
		fetchConfigModules,
	};
};

