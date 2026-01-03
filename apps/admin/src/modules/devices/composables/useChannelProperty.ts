import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IChannelProperty } from '../store/channels.properties.store.types';
import type { IChannel } from '../store/channels.store.types';
import { channelsPropertiesStoreKey } from '../store/keys';

import type { IUseChannelProperty } from './types';

interface IUseChannelPropertyProps {
	channelId: IChannel['id'];
	id: IChannelProperty['id'];
}

export const useChannelProperty = ({ channelId, id }: IUseChannelPropertyProps): IUseChannelProperty => {
	const storesManager = injectStoresManager();

	const propertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

	const { data, semaphore } = storeToRefs(propertiesStore);

	const property = computed<IChannelProperty | null>((): IChannelProperty | null => {
		if (id === null) {
			return null;
		}

		return data.value[id] ?? null;
	});

	const fetchProperty = async (): Promise<void> => {
		const item = data.value[id] ?? null;

		if (item?.draft) {
			return;
		}

		await propertiesStore.get({ id, channelId });
	};

	const isLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.item.includes(id)) {
			return true;
		}

		const item = data.value[id] ?? null;

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
