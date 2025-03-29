import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { type IChannel, type IChannelProperty, channelsPropertiesStoreKey } from '../store';

import type { IUseChannelProperty } from './types';

export const useChannelProperty = (channelId: IChannel['id'], id: IChannelProperty['id']): IUseChannelProperty => {
	const storesManager = injectStoresManager();

	const propertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

	const { data, semaphore } = storeToRefs(propertiesStore);

	const property = computed<IChannelProperty | null>((): IChannelProperty | null => {
		if (id === null) {
			return null;
		}

		return id in data.value ? data.value[id] : null;
	});

	const fetchProperty = async (): Promise<void> => {
		const item = id in data.value ? data.value[id] : null;

		if (item?.draft) {
			return;
		}

		await propertiesStore.get({ id, channelId });
	};

	const isLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.item.includes(id)) {
			return true;
		}

		const item = id in data.value ? data.value[id] : null;

		if (item !== null) {
			return false;
		}

		return semaphore.value.fetching.items.includes(channelId) || semaphore.value.fetching.items.includes('all');
	});

	return {
		property,
		isLoading,
		fetchProperty,
	};
};
