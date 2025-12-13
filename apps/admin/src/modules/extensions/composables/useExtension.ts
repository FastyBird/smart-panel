import { computed, type ComputedRef, type Ref, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IExtension } from '../store/extensions.store.types';
import { extensionsStoreKey } from '../store/keys';

interface IUseExtensionProps {
	type: IExtension['type'];
}

interface IUseExtension {
	extension: ComputedRef<IExtension | null>;
	isLoading: ComputedRef<boolean>;
	fetchExtension: () => Promise<void>;
}

export const useExtension = (props: IUseExtensionProps): IUseExtension => {
	const storesManager = injectStoresManager();

	const extensionsStore = storesManager.getStore(extensionsStoreKey);

	const { semaphore, firstLoad } = storeToRefs(extensionsStore);

	const extension = computed<IExtension | null>(() => {
		return extensionsStore.findByType(props.type);
	});

	const isLoading = computed<boolean>(() => {
		if (firstLoad.value) {
			return false;
		}
		return semaphore.value.fetching.items;
	});

	const fetchExtension = async (): Promise<void> => {
		await extensionsStore.fetch();
	};

	return {
		extension,
		isLoading,
		fetchExtension,
	};
};
