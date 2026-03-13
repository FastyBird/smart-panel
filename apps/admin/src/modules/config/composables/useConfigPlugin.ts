import { computed, type MaybeRef, unref } from 'vue';

import { storeToRefs } from 'pinia';

import { type IPlugin, injectStoresManager } from '../../../common';
import { extensionsStoreKey } from '../../extensions/store/keys';
import type { IConfigPlugin } from '../store/config-plugins.store.types';
import { configPluginsStoreKey } from '../store/keys';

import type { IUseConfigPlugin } from './types';

interface IUseConfigPluginProps {
	type: MaybeRef<IPlugin['type']>;
}

export const useConfigPlugin = ({ type }: IUseConfigPluginProps): IUseConfigPlugin => {
	const storesManager = injectStoresManager();

	const configPluginStore = storesManager.getStore(configPluginsStoreKey);
	const extensionsStore = storesManager.getStore(extensionsStoreKey);

	const { data, semaphore } = storeToRefs(configPluginStore);

	// Create a computed ref that reactively accesses the type value
	const typeRef = computed(() => unref(type));

	const configPlugin = computed<IConfigPlugin | null>((): IConfigPlugin | null => {
		return configPluginStore.findByType(typeRef.value);
	});

	const fetchConfigPlugin = async (): Promise<void> => {
		try {
			await configPluginStore.get({ type: typeRef.value });
		} catch {
			// Config may not exist yet — seed a default entry so the form can render
			if (!configPlugin.value) {
				try {
					const extension = extensionsStore.findByType(typeRef.value);

					configPluginStore.set({ data: { type: typeRef.value, enabled: extension?.enabled ?? false } as { type: string } });
				} catch {
					// Schema validation failure — nothing we can do
				}
			}
		}
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
