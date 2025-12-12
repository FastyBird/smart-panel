import { computed, type MaybeRef, unref } from 'vue';

import { storeToRefs } from 'pinia';

import { type IModule, injectStoresManager } from '../../../common';
import type { IConfigModule } from '../store/config-modules.store.types';
import { configModulesStoreKey } from '../store/keys';

import type { IUseConfigModule } from './types';

interface IUseConfigModuleProps {
	type: MaybeRef<IModule['type']>;
}

export const useConfigModule = ({ type }: IUseConfigModuleProps): IUseConfigModule => {
	const storesManager = injectStoresManager();

	const configModuleStore = storesManager.getStore(configModulesStoreKey);

	const { data, semaphore } = storeToRefs(configModuleStore);

	// Create a computed ref that reactively accesses the type value
	const typeRef = computed(() => unref(type));

	const configModule = computed<IConfigModule | null>((): IConfigModule | null => {
		return configModuleStore.findByType(typeRef.value);
	});

	const fetchConfigModule = async (): Promise<void> => {
		await configModuleStore.get({ type: typeRef.value });
	};

	const isLoading = computed<boolean>((): boolean => {
		const currentType = typeRef.value;
		if (currentType in data.value) {
			return false;
		}

		return semaphore.value.fetching.item.includes(currentType);
	});

	return {
		configModule,
		isLoading,
		fetchConfigModule,
	};
};

