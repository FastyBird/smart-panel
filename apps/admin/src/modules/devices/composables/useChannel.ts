import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { type IChannel, channelsStoreKey } from '../store';

import type { IUseChannel } from './types';

export const useChannel = (id: IChannel['id']): IUseChannel => {
	const storesManager = injectStoresManager();

	const channelsStore = storesManager.getStore(channelsStoreKey);

	const { data, semaphore } = storeToRefs(channelsStore);

	const channel = computed<IChannel | null>((): IChannel | null => {
		if (id === null) {
			return null;
		}

		return id in data.value ? data.value[id] : null;
	});

	const fetchChannel = async (): Promise<void> => {
		const item = id in data.value ? data.value[id] : null;

		if (item?.draft) {
			return;
		}

		await channelsStore.get({ id });
	};

	const isLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.item.includes(id)) {
			return true;
		}

		const item = id in data.value ? data.value[id] : null;

		if (item !== null) {
			return false;
		}

		return semaphore.value.fetching.items.includes('all');
	});

	return {
		channel,
		isLoading,
		fetchChannel,
	};
};
