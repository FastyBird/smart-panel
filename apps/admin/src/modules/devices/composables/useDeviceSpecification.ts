import { computed } from 'vue';

import { injectStoresManager } from '../../../common';
import type { DevicesModuleChannelCategory } from '../../../openapi';
import { DevicesException } from '../devices.exceptions';
import { deviceChannelsSpecificationMappers } from '../devices.mapping';
import type { IDevice } from '../store/devices.store.types';
import { channelsStoreKey, devicesStoreKey } from '../store/keys';

import type { IUseDeviceSpecification } from './types';

interface IUseDeviceSpecificationProps {
	id: IDevice['id'];
}

export const useDeviceSpecification = ({ id }: IUseDeviceSpecificationProps): IUseDeviceSpecification => {
	const storesManager = injectStoresManager();

	const devicesStore = storesManager.getStore(devicesStoreKey);
	const channelsStore = storesManager.getStore(channelsStoreKey);

	const getDevice = (id: IDevice['id']): IDevice | null => {
		return devicesStore.findById(id);
	};

	const getDeviceSpecification = (
		device: IDevice
	): { required: DevicesModuleChannelCategory[]; optional: DevicesModuleChannelCategory[]; multiple?: DevicesModuleChannelCategory[] } | null => {
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

	const missingRequiredChannels = computed<DevicesModuleChannelCategory[]>((): DevicesModuleChannelCategory[] => {
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
