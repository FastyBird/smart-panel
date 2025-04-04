import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { type IDevice, devicesStoreKey } from '../store';

import type { IUseDevice } from './types';

interface IUseDeviceProps {
	id: IDevice['id'];
}

export const useDevice = ({ id }: IUseDeviceProps): IUseDevice => {
	const storesManager = injectStoresManager();

	const devicesStore = storesManager.getStore(devicesStoreKey);

	const { data, semaphore } = storeToRefs(devicesStore);

	const device = computed<IDevice | null>((): IDevice | null => {
		if (id === null) {
			return null;
		}

		return id in data.value ? data.value[id] : null;
	});

	const fetchDevice = async (): Promise<void> => {
		const item = id in data.value ? data.value[id] : null;

		if (item?.draft) {
			return;
		}

		await devicesStore.get({ id });
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
		device,
		isLoading,
		fetchDevice,
	};
};
