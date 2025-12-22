import { computed, type ComputedRef, type Ref, toRef } from 'vue';

import { injectStoresManager } from '../../../common';

import { discoveredDevicesStoreKey } from '../store/keys';
import type { IZigbee2mqttDiscoveredDevice } from '../store/zigbee2mqtt-discovered-devices.store.types';

export interface IUseDiscoveredDevices {
	devices: ComputedRef<IZigbee2mqttDiscoveredDevice[]>;
	isLoading: Ref<boolean>;
	firstLoadFinished: ComputedRef<boolean>;
	fetchDiscoveredDevices: () => Promise<IZigbee2mqttDiscoveredDevice[]>;
	getDiscoveredDevice: (id: string) => Promise<IZigbee2mqttDiscoveredDevice>;
	findById: (id: string) => IZigbee2mqttDiscoveredDevice | null;
}

export const useDiscoveredDevices = (): IUseDiscoveredDevices => {
	const storesManager = injectStoresManager();
	const discoveredDevicesStore = storesManager.getStore(discoveredDevicesStoreKey);

	const devices = computed(() => discoveredDevicesStore.findAll());

	const isLoading = toRef(() => discoveredDevicesStore.fetching());

	const firstLoadFinished = computed(() => discoveredDevicesStore.firstLoadFinished());

	const fetchDiscoveredDevices = async (): Promise<IZigbee2mqttDiscoveredDevice[]> => {
		return discoveredDevicesStore.fetch();
	};

	const getDiscoveredDevice = async (id: string): Promise<IZigbee2mqttDiscoveredDevice> => {
		return discoveredDevicesStore.get({ id });
	};

	const findById = (id: string): IZigbee2mqttDiscoveredDevice | null => {
		return discoveredDevicesStore.findById(id);
	};

	return {
		devices,
		isLoading,
		firstLoadFinished,
		fetchDiscoveredDevices,
		getDiscoveredDevice,
		findById,
	};
};
