import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { type IDevice, devicesStoreKey } from '../store';

import type { IUseDevices } from './types';

export const useDevices = (): IUseDevices => {
	const storesManager = injectStoresManager();

	const devicesStore = storesManager.getStore(devicesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(devicesStore);

	const devices = computed<IDevice[]>((): IDevice[] => {
		return devicesStore.findAll().filter((device) => !device.draft);
	});

	const fetchDevices = async (): Promise<void> => {
		await devicesStore.fetch();
	};

	const areLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.items) {
			return true;
		}

		if (firstLoad.value) {
			return false;
		}

		return semaphore.value.fetching.items;
	});

	const loaded = computed<boolean>((): boolean => {
		return firstLoad.value;
	});

	return {
		devices,
		areLoading,
		loaded,
		fetchDevices,
	};
};
