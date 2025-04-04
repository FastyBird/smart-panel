import { computed } from 'vue';

import { injectStoresManager } from '../../../common';
import type { DevicesChannelCategory } from '../../../openapi';
import { DevicesException } from '../devices.exceptions';
import { deviceChannelsSpecificationMappers } from '../devices.mapping';
import { type IDevice, channelsStoreKey, devicesStoreKey } from '../store';

import type { IUseDeviceSpecification } from './types';

export const useDeviceSpecification = (id: IDevice['id']): IUseDeviceSpecification => {
	const storesManager = injectStoresManager();

	const devicesStore = storesManager.getStore(devicesStoreKey);
	const channelsStore = storesManager.getStore(channelsStoreKey);

	const getDevice = (id: IDevice['id']): IDevice | null => {
		return devicesStore.findById(id);
	};

	const getDeviceSpecification = (
		device: IDevice
	): { required: DevicesChannelCategory[]; optional: DevicesChannelCategory[]; multiple?: DevicesChannelCategory[] } | null => {
		if (!(device.category in deviceChannelsSpecificationMappers)) {
			return null;
		}

		return deviceChannelsSpecificationMappers[device.category];
	};

	const canAddAnotherChannel = computed<boolean>((): boolean => {
		const device = getDevice(id);

		if (device === null) {
			return true;
		}

		const { required, optional, multiple } = getDeviceSpecification(device) ?? { required: [], optional: [] };

		const allowedCategories = [...required, ...optional];

		const existingCategories = channelsStore.findForDevice(device.id).map((channel) => channel.category);

		const remaining = allowedCategories.filter((category) => !existingCategories.includes(category));

		return remaining.length > 0 || (typeof multiple !== 'undefined' && multiple.length > 0);
	});

	const missingRequiredChannels = computed<DevicesChannelCategory[]>((): DevicesChannelCategory[] => {
		const device = getDevice(id);

		if (device === null) {
			throw new DevicesException("Something went wrong, device can't be loaded");
		}

		const { required } = getDeviceSpecification(device) ?? { required: [] };

		const existingCategories = channelsStore.findForDevice(device.id).map((device) => device.category);

		return required.filter((category) => !existingCategories.includes(category));
	});

	return {
		canAddAnotherChannel,
		missingRequiredChannels,
	};
};
