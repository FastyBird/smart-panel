import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IDisplayProfile } from '../store/displays-profiles.store.types';
import { displaysStoreKey } from '../store/keys';

import type { IUseDisplayProfile } from './types';

interface IUseDisplayProfileProps {
	id: IDisplayProfile['id'];
}

export const useDisplayProfile = ({ id }: IUseDisplayProfileProps): IUseDisplayProfile => {
	const storesManager = injectStoresManager();

	const displaysStore = storesManager.getStore(displaysStoreKey);

	const { data, semaphore } = storeToRefs(displaysStore);

	const display = computed<IDisplayProfile | null>((): IDisplayProfile | null => {
		if (id === null) {
			return null;
		}

		return id in data.value ? data.value[id] : null;
	});

	const fetchDisplay = async (): Promise<void> => {
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
