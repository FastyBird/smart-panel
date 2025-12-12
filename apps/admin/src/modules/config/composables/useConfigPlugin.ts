import { computed, type MaybeRef, unref } from 'vue';

import { storeToRefs } from 'pinia';

import { type IPlugin, injectStoresManager } from '../../../common';
import type { IConfigPlugin } from '../store/config-plugins.store.types';
import { configPluginsStoreKey } from '../store/keys';

import type { IUseConfigPlugin } from './types';

interface IUseConfigPluginProps {
	type: MaybeRef<IPlugin['type']>;
}

export const useConfigPlugin = ({ type }: IUseConfigPluginProps): IUseConfigPlugin => {
	const storesManager = injectStoresManager();

	const configPluginStore = storesManager.getStore(configPluginsStoreKey);

	const { data, semaphore } = storeToRefs(configPluginStore);

	// Create a computed ref that reactively accesses the type value
	const typeRef = computed(() => unref(type));

	const configPlugin = computed<IConfigPlugin | null>((): IConfigPlugin | null => {
		return configPluginStore.findByType(typeRef.value);
	});

	const fetchConfigPlugin = async (): Promise<void> => {
		await configPluginStore.get({ type: typeRef.value });
	};

	const isLoading = computed<boolean>((): boolean => {
		const currentType = typeRef.value;
		if (currentType in data.value) {
			return false;
		}

		return semaphore.value.fetching.item.includes(currentType);
	});

	return {
		configPlugin,
		isLoading,
		fetchConfigPlugin,
	};
};
