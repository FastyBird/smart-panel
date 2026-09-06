import { type MaybeRefOrGetter, computed, toValue } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IDevice } from '../store/devices.store.types';
import { devicesStoreKey } from '../store/keys';

import type { IUseDevice } from './types';

interface IUseDeviceProps {
	id: MaybeRefOrGetter<IDevice['id']>;
}

export const useDevice = ({ id }: IUseDeviceProps): IUseDevice => {
	const storesManager = injectStoresManager();

	const devicesStore = storesManager.getStore(devicesStoreKey);

	const { data, semaphore } = storeToRefs(devicesStore);

	const device = computed<IDevice | null>((): IDevice | null => {
		const deviceId = toValue(id);

		if (deviceId === null) {
			return null;
		}

		return data.value[deviceId] ?? null;
	});

	const fetchDevice = async (): Promise<void> => {
		const deviceId = toValue(id);
		const item = data.value[deviceId] ?? null;

		if (item?.draft) {
			return;
		}

		await devicesStore.get({ id: deviceId });
	};

	const isLoading = computed<boolean>((): boolean => {
		const deviceId = toValue(id);

		if (semaphore.value.fetching.item.includes(deviceId)) {
			return true;
		}

		const item = data.value[deviceId] ?? null;

		if (item !== null) {
			return false;
		}

		return semaphore.value.fetching.items;
	});

	return {
		device,
		isLoading,
		fetchDevice,
	};
};
