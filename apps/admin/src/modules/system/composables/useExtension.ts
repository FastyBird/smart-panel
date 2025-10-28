import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IExtension } from '../store/extensions.store.types';
import { extensionsStoreKey } from '../store/keys';

import type { IUseExtension } from './types';

interface IUseExtensionProps {
	name: IExtension['name'];
}

export const useExtension = ({ name }: IUseExtensionProps): IUseExtension => {
	const storesManager = injectStoresManager();

	const extensionsStore = storesManager.getStore(extensionsStoreKey);

	const { data, semaphore } = storeToRefs(extensionsStore);

	const extension = computed<{ admin?: IExtension; backend?: IExtension } | null>((): { admin?: IExtension; backend?: IExtension } | null => {
		if (name === null) {
			return null;
		}

		return name in data.value ? data.value[name] : null;
	});

	const fetchExtension = async (): Promise<void> => {
		await extensionsStore.get({ name });
	};

	const isLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.item.includes(name)) {
			return true;
		}

		const item = name in data.value ? data.value[name] : null;

		if (item !== null) {
			return false;
		}

		return semaphore.value.fetching.items;
	});

	return {
		extension,
		isLoading,
		fetchExtension,
	};
};
