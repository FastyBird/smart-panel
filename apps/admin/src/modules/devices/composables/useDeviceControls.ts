import { type ComputedRef, computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IDeviceControl } from '../store/devices.controls.store.types';
import type { IDevice } from '../store/devices.store.types';
import { devicesControlsStoreKey } from '../store/keys';

import type { IUseDeviceControls } from './types';

interface IUseDeviceControlsProps {
	deviceId: IDevice['id'] | ComputedRef<IDevice['id']>;
}

export const useDeviceControls = ({ deviceId }: IUseDeviceControlsProps): IUseDeviceControls => {
	const storesManager = injectStoresManager();
	const devicesControlsStore = storesManager.getStore(devicesControlsStoreKey);

	const { firstLoad, semaphore } = storeToRefs(devicesControlsStore);

	const controls = computed<IDeviceControl[]>((): IDeviceControl[] => {
		return devicesControlsStore.findForDevice(typeof deviceId === 'string' ? deviceId : deviceId.value);
	});

	const areLoading = computed<boolean>((): boolean => {
		return semaphore.value.fetching.items.includes(typeof deviceId === 'string' ? deviceId : deviceId.value);
	});

	const loaded = computed<boolean>((): boolean => {
		return firstLoad.value.includes(typeof deviceId === 'string' ? deviceId : deviceId.value);
	});

	const fetchControls = async (): Promise<IDeviceControl[]> => {
		return devicesControlsStore.fetch({ deviceId: typeof deviceId === 'string' ? deviceId : deviceId.value });
	};

	return {
		controls,
		areLoading,
		loaded,
		fetchControls,
	};
};
