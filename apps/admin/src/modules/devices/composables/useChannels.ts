import { type ComputedRef, computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IChannel } from '../store/channels.store.types';
import type { IDevice } from '../store/devices.store.types';
import { channelsStoreKey } from '../store/keys';

import type { IUseChannels } from './types';

interface IUseChannelsProps {
	deviceId?: IDevice['id'] | ComputedRef<IDevice['id']>;
}

export const useChannels = (props: IUseChannelsProps = {}): IUseChannels => {
	const { deviceId } = props;

	const storesManager = injectStoresManager();

	const channelsStore = storesManager.getStore(channelsStoreKey);

	const { firstLoad, semaphore } = storeToRefs(channelsStore);

	const device: ComputedRef<IDevice['id']> | undefined =
		typeof deviceId === 'undefined' ? undefined : typeof deviceId === 'string' ? computed<IDevice['id']>((): IChannel['id'] => deviceId) : deviceId;

	const channels = computed<IChannel[]>((): IChannel[] => {
		return channelsStore.findAll().filter((channel) => !device?.value || channel.device === device.value);
	});

	const fetchChannels = async (): Promise<void> => {
		await channelsStore.fetch({ deviceId: device?.value });
	};

	const areLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.items.includes(device?.value ?? 'all')) {
			return true;
		}

		if (firstLoad.value.includes(device?.value ?? 'all')) {
			return false;
		}

		return semaphore.value.fetching.items.includes(device?.value ?? 'all');
	});

	const loaded = computed<boolean>((): boolean => {
		return firstLoad.value.includes(device?.value ?? 'all');
	});

	return {
		channels,
		areLoading,
		loaded,
		fetchChannels,
	};
};
