import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { type IPlugin, injectStoresManager } from '../../../common';
import type { IConfigPlugin } from '../store/config-plugins.store.types';
import { configPluginsStoreKey } from '../store/keys';

import type { IUseConfigPlugin } from './types';

interface IUseConfigPluginProps {
	type: IPlugin['type'];
}

export const useConfigPlugin = ({ type }: IUseConfigPluginProps): IUseConfigPlugin => {
	const storesManager = injectStoresManager();

	const configPluginStore = storesManager.getStore(configPluginsStoreKey);

	const { data, semaphore } = storeToRefs(configPluginStore);

	const configPlugin = computed<IConfigPlugin | null>((): IConfigPlugin | null => {
		return type in data.value ? data.value[type] : null;
	});

	const fetchConfigPlugin = async (): Promise<void> => {
		await configPluginStore.get({ type });
	};

	const isLoading = computed<boolean>((): boolean => {
		if (type in data.value) {
			return false;
		}

		return semaphore.value.getting.includes(type);
	});

	return {
		configPlugin,
		isLoading,
		fetchConfigPlugin,
	};
};
