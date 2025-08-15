import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IDisplayInstance } from '../store/displays-instances.store.types';
import { displaysInstancesStoreKey } from '../store/keys';

import type { IUseDisplayInstance } from './types';

interface IUseDisplayInstanceProps {
	id: IDisplayInstance['id'];
}

export const useDisplayInstance = ({ id }: IUseDisplayInstanceProps): IUseDisplayInstance => {
	const storesManager = injectStoresManager();

	const displaysStore = storesManager.getStore(displaysInstancesStoreKey);

	const { data, semaphore } = storeToRefs(displaysStore);

	const display = computed<IDisplayInstance | null>((): IDisplayInstance | null => {
		if (id === null) {
			return null;
		}

		return id in data.value ? data.value[id] : null;
	});

	const fetchDisplay = async (): Promise<void> => {
		const item = id in data.value ? data.value[id] : null;

		if (item?.draft) {
			return;
		}

		await displaysStore.get({ id });
	};

	const isLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.item.includes(id)) {
			return true;
		}

		const item = id in data.value ? data.value[id] : null;

		if (item !== null) {
			return false;
		}

		return semaphore.value.fetching.items;
	});

	return {
		display,
		isLoading,
		fetchDisplay,
	};
};
