import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IHomeAssistantDiscoveredDevice } from '../store/home-assistant-discovered-devices.store.types';
import { discoveredDevicesStoreKey } from '../store/keys';

import type { IUseDiscoveredDevices } from './types';

export const useDiscoveredDevices = (): IUseDiscoveredDevices => {
	const storesManager = injectStoresManager();

	const devicesStore = storesManager.getStore(discoveredDevicesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(devicesStore);

	const devices = computed<IHomeAssistantDiscoveredDevice[]>((): IHomeAssistantDiscoveredDevice[] => {
		return devicesStore.findAll();
	});

	const fetchDiscoveredDevices = async (): Promise<void> => {
		await devicesStore.fetch();
	};

	const areLoading = computed<boolean>((): boolean => {
		return !!semaphore.value.fetching.items || !firstLoad.value;
	});

	const loaded = computed<boolean>((): boolean => {
		return firstLoad.value;
	});

	return {
		devices,
		areLoading,
		loaded,
		fetchDiscoveredDevices,
	};
};
