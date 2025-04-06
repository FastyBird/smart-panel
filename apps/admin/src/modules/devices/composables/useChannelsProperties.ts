import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IChannelProperty } from '../store/channels.properties.store.types';
import type { IChannel } from '../store/channels.store.types';
import { channelsPropertiesStoreKey } from '../store/keys';

import type { IUseChannelsProperties } from './types';

interface IUseChannelsPropertiesProps {
	channelId: IChannel['id'];
}

export const useChannelsProperties = ({ channelId }: IUseChannelsPropertiesProps): IUseChannelsProperties => {
	const storesManager = injectStoresManager();

	const propertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(propertiesStore);

	const properties = computed<IChannelProperty[]>((): IChannelProperty[] => {
		return propertiesStore.findAll().filter((property) => !channelId || property.channel === channelId);
	});

	const fetchProperties = async (): Promise<void> => {
		await propertiesStore.fetch({ channelId });
	};

	const areLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.items.includes(channelId)) {
			return true;
		}

		if (firstLoad.value.includes(channelId)) {
			return false;
		}

		return semaphore.value.fetching.items.includes(channelId);
	});

	const loaded = computed<boolean>((): boolean => {
		return firstLoad.value.includes(channelId);
	});

	return {
		properties,
		areLoading,
		loaded,
		fetchProperties,
	};
};
