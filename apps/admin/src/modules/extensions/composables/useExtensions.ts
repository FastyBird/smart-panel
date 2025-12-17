import { computed, type Ref } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { ExtensionKind } from '../extensions.constants';
import type { IExtension } from '../store/extensions.store.types';
import { extensionsStoreKey } from '../store/keys';

interface IUseExtensions {
	extensions: Ref<IExtension[]>;
	modules: Ref<IExtension[]>;
	plugins: Ref<IExtension[]>;
	areLoading: Ref<boolean>;
	fetchExtensions: () => Promise<void>;
}

export const useExtensions = (): IUseExtensions => {
	const storesManager = injectStoresManager();

	const extensionsStore = storesManager.getStore(extensionsStoreKey);

	const { data, semaphore } = storeToRefs(extensionsStore);

	const extensions = computed<IExtension[]>(() => {
		return Object.values(data.value);
	});

	const modules = computed<IExtension[]>(() => {
		return Object.values(data.value).filter((ext) => ext.kind === ExtensionKind.MODULE);
	});

	const plugins = computed<IExtension[]>(() => {
		return Object.values(data.value).filter((ext) => ext.kind === ExtensionKind.PLUGIN);
	});

	const areLoading = computed<boolean>(() => {
		return semaphore.value.fetching.items;
	});

	const fetchExtensions = async (): Promise<void> => {
		await extensionsStore.fetch();
	};

	return {
		extensions,
		modules,
		plugins,
		areLoading,
		fetchExtensions,
	};
};
