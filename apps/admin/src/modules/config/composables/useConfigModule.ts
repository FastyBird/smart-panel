import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { type IModule, injectStoresManager } from '../../../common';
import type { IConfigModule } from '../store/config-modules.store.types';
import { configModulesStoreKey } from '../store/keys';

import type { IUseConfigModule } from './types';

interface IUseConfigModuleProps {
	type: IModule['type'];
}

export const useConfigModule = ({ type }: IUseConfigModuleProps): IUseConfigModule => {
	const storesManager = injectStoresManager();

	const configModuleStore = storesManager.getStore(configModulesStoreKey);

	const { data, semaphore } = storeToRefs(configModuleStore);

	const configModule = computed<IConfigModule | null>((): IConfigModule | null => {
		return configModuleStore.findByType(type);
	});

	const fetchConfigModule = async (): Promise<void> => {
		await configModuleStore.get({ type });
	};

	const isLoading = computed<boolean>((): boolean => {
		if (type in data.value) {
			return false;
		}

		return semaphore.value.fetching.item.includes(type);
	});

	return {
		configModule,
		isLoading,
		fetchConfigModule,
	};
};

