import { type ComputedRef, computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IChannelProperty } from '../store/channels.properties.store.types';
import type { IChannel } from '../store/channels.store.types';
import { channelsPropertiesStoreKey } from '../store/keys';

import type { IUseChannelsProperties } from './types';

interface IUseChannelsPropertiesProps {
	channelId: IChannel['id'] | ComputedRef<IChannel['id'] | undefined>;
}

export const useChannelsProperties = ({ channelId }: IUseChannelsPropertiesProps): IUseChannelsProperties => {
	const storesManager = injectStoresManager();

	const propertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(propertiesStore);

	const channel: ComputedRef<IChannel['id'] | undefined> =
		typeof channelId === 'string' ? computed<IChannel['id']>((): IChannel['id'] => channelId) : channelId;

	const properties = computed<IChannelProperty[]>((): IChannelProperty[] => {
		return propertiesStore.findAll().filter((property) => !channel?.value || property.channel === channel.value);
	});

	const fetchProperties = async (): Promise<void> => {
		if (!channel.value) {
			return;
		}

		await propertiesStore.fetch({ channelId: channel.value });
	};

	const areLoading = computed<boolean>((): boolean => {
		if (!channel.value) {
			return false;
		}

		if (semaphore.value.fetching.items.includes(channel.value)) {
			return true;
		}

		if (firstLoad.value.includes(channel.value)) {
			return false;
		}

		return semaphore.value.fetching.items.includes(channel.value);
	});

	const loaded = computed<boolean>((): boolean => {
		return channel.value ? firstLoad.value.includes(channel.value) : false;
	});

	return {
		properties,
		areLoading,
		loaded,
		fetchProperties,
	};
};
