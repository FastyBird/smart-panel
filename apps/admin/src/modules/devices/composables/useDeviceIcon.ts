import { computed } from 'vue';

import { injectStoresManager } from '../../../common';
import type { IDevice } from '../store/devices.store.types';
import { devicesStoreKey } from '../store/keys';

import type { IUseDeviceIcon } from './types';

interface IUseDeviceIconProps {
	id: IDevice['id'];
}

export const useDeviceIcon = ({ id }: IUseDeviceIconProps): IUseDeviceIcon => {
	const storesManager = injectStoresManager();

	const devicesStore = storesManager.getStore(devicesStoreKey);

	const icon = computed<string>((): string => {
		const device = devicesStore.findById(id);

		switch (device?.category) {
			default:
				return 'mdi:power-plug';
		}
	});

	return {
		icon,
	};
};
