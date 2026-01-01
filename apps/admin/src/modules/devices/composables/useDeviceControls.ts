import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IDeviceControl } from '../store/devices.controls.store.types';
import type { IDevice } from '../store/devices.store.types';
import { devicesControlsStoreKey } from '../store/keys';

import type { IUseDeviceControls } from './types';

interface IUseDeviceControlsProps {
	deviceId: IDevice['id'];
}

export const useDeviceControls = ({ deviceId }: IUseDeviceControlsProps): IUseDeviceControls => {
	const storesManager = injectStoresManager();
	const devicesControlsStore = storesManager.getStore(devicesControlsStoreKey);

	const { firstLoad, semaphore } = storeToRefs(devicesControlsStore);

	const controls = computed<IDeviceControl[]>((): IDeviceControl[] => {
		return devicesControlsStore.findForDevice(deviceId);
	});

	const areLoading = computed<boolean>((): boolean => {
		return semaphore.value.fetching.items.includes(deviceId);
	});

	const loaded = computed<boolean>((): boolean => {
		return firstLoad.value.includes(deviceId);
	});

	const fetchControls = async (): Promise<IDeviceControl[]> => {
		return devicesControlsStore.fetch({ deviceId });
	};

	return {
		controls,
		areLoading,
		loaded,
		fetchControls,
	};
};
