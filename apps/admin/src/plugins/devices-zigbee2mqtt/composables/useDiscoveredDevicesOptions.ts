import { computed, type ComputedRef, onMounted, type Ref, toRef } from 'vue';

import { orderBy } from 'natural-orderby';

import { injectStoresManager } from '../../../common';

import { discoveredDevicesStoreKey } from '../store/keys';

export interface IDiscoveredDeviceOption {
	value: string;
	label: string;
	manufacturer: string | null;
	model: string | null;
	available: boolean;
}

export interface IUseDiscoveredDevicesOptions {
	devicesOptions: ComputedRef<IDiscoveredDeviceOption[]>;
	devicesOptionsLoading: Ref<boolean>;
	refreshDevices: () => Promise<void>;
}

export const useDiscoveredDevicesOptions = (): IUseDiscoveredDevicesOptions => {
	const storesManager = injectStoresManager();
	const discoveredDevicesStore = storesManager.getStore(discoveredDevicesStoreKey);

	const devicesOptions = computed<IDiscoveredDeviceOption[]>(() => {
		const devices = discoveredDevicesStore.findAll();

		// Include all devices (adopted ones can be re-adopted), sort by friendly name
		const sortedDevices = orderBy(devices, [(d) => d.friendlyName.toLowerCase()], ['asc']);

		return sortedDevices.map((device) => ({
			value: device.id,
			label: device.friendlyName,
			manufacturer: device.manufacturer,
			model: device.model,
			available: device.available,
		}));
	});

	const devicesOptionsLoading = toRef(() => discoveredDevicesStore.fetching());

	const refreshDevices = async (): Promise<void> => {
		await discoveredDevicesStore.fetch();
	};

	onMounted(() => {
		if (!discoveredDevicesStore.firstLoadFinished()) {
			refreshDevices().catch(() => {
				// Error is handled in the store
			});
		}
	});

	return {
		devicesOptions,
		devicesOptionsLoading,
		refreshDevices,
	};
};
