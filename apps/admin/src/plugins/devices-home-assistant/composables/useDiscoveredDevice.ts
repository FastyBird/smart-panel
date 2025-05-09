import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IHomeAssistantDiscoveredDevice } from '../store/home-assistant-discovered-devices.store.types';
import { discoveredDevicesStoreKey } from '../store/keys';

import type { IUseDiscoveredDevice } from './types';

interface IUseDeviceProps {
	id: IHomeAssistantDiscoveredDevice['id'];
}

export const useDiscoveredDevice = ({ id }: IUseDeviceProps): IUseDiscoveredDevice => {
	const storesManager = injectStoresManager();

	const devicesStore = storesManager.getStore(discoveredDevicesStoreKey);

	const { data, semaphore } = storeToRefs(devicesStore);

	const device = computed<IHomeAssistantDiscoveredDevice | null>((): IHomeAssistantDiscoveredDevice | null => {
		if (id === null) {
			return null;
		}

		return id in data.value ? data.value[id] : null;
	});

	const fetchDevice = async (): Promise<void> => {
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
