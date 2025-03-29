import { computed } from 'vue';

import { injectStoresManager } from '../../../common';
import { type IDevice, devicesStoreKey } from '../store';

import type { IUseDeviceIcon } from './types';

export function useDeviceIcon(id: IDevice['id']): IUseDeviceIcon {
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
}
