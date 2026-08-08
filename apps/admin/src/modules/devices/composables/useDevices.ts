import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IDevice } from '../store/devices.store.types';
import { devicesStoreKey } from '../store/keys';

import type { IUseDevices } from './types';

export const useDevices = (): IUseDevices => {
	const storesManager = injectStoresManager();

	const devicesStore = storesManager.getStore(devicesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(devicesStore);

	// Hidden devices are excluded here, not only at the fetch. The shared collection is deliberately
	// filled with everything — a reconnect refresh restores it wholesale so the device list's own
	// "show hidden" view and an open mapping flow survive — so the general-purpose selector is where
	// "hidden means hidden" has to hold. A surface that genuinely wants them (the device list behind
	// its toggle, the virtual wizard's source picker) reads the store directly and says so.
	const devices = computed<IDevice[]>((): IDevice[] => {
		return devicesStore.findAll().filter((device) => !device.draft && !device.hidden);
	});

	const fetchDevices = async (): Promise<void> => {
		await devicesStore.fetch();
	};

	const areLoading = computed<boolean>((): boolean => {
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
