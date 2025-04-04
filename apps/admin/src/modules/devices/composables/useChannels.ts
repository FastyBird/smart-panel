import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { type IChannel, type IDevice, channelsStoreKey } from '../store';

import type { IUseChannels } from './types';

interface IUseChannelsProps {
	deviceId?: IDevice['id'];
}

export const useChannels = (props: IUseChannelsProps = {}): IUseChannels => {
	const { deviceId } = props;

	const storesManager = injectStoresManager();

	const channelsStore = storesManager.getStore(channelsStoreKey);

	const { firstLoad, semaphore } = storeToRefs(channelsStore);

	const channels = computed<IChannel[]>((): IChannel[] => {
		return channelsStore.findAll().filter((channel) => !deviceId || channel.device === deviceId);
	});

	const fetchChannels = async (): Promise<void> => {
		await channelsStore.fetch({ deviceId });
	};

	const areLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.items.includes(deviceId ?? 'all')) {
			return true;
		}

		if (firstLoad.value.includes(deviceId ?? 'all')) {
			return false;
		}

		return semaphore.value.fetching.items.includes(deviceId ?? 'all');
	});

	const loaded = computed<boolean>((): boolean => {
		return firstLoad.value.includes(deviceId ?? 'all');
	});

	return {
		channels,
		areLoading,
		loaded,
		fetchChannels,
	};
};
