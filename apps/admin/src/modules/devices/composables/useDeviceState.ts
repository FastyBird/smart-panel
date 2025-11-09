import { computed } from 'vue';

import { injectStoresManager } from '../../../common';
import { DevicesModuleChannelCategory, DevicesModuleChannelPropertyCategory, DevicesModuleDeviceStatusStatus } from '../../../openapi';
import type { IDevice } from '../store/devices.store.types';
import { channelsPropertiesStoreKey, channelsStoreKey } from '../store/keys';

import type { IUseDeviceState } from './types';

interface IUseDeviceStateProps {
	device: IDevice;
}

export const useDeviceState = ({ device }: IUseDeviceStateProps): IUseDeviceState => {
	const storesManager = injectStoresManager();

	const channelsStore = storesManager.getStore(channelsStoreKey);

	const channelsPropertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

	const state = computed<DevicesModuleDeviceStatusStatus>((): DevicesModuleDeviceStatusStatus => {
		const channel =
			channelsStore.findForDevice(device.id).find((channel) => channel.category === DevicesModuleChannelCategory.device_information) || null;

		if (!channel) {
			return DevicesModuleDeviceStatusStatus.unknown;
		}

		const property =
			channelsPropertiesStore.findForChannel(channel.id).find((property) => property.category === DevicesModuleChannelPropertyCategory.status) ||
			null;

		if (!property) {
			return DevicesModuleDeviceStatusStatus.unknown;
		}

		if (
			typeof property.value === 'string' &&
			Object.values(DevicesModuleDeviceStatusStatus).includes(property.value as DevicesModuleDeviceStatusStatus)
		) {
			return property.value as DevicesModuleDeviceStatusStatus;
		}

		return DevicesModuleDeviceStatusStatus.unknown;
	});

	const isReady = computed<boolean>((): boolean => {
		return (
			[DevicesModuleDeviceStatusStatus.ready, DevicesModuleDeviceStatusStatus.connected, DevicesModuleDeviceStatusStatus.running] as string[]
		).includes(state.value);
	});

	return {
		state,
		isReady,
	};
};
