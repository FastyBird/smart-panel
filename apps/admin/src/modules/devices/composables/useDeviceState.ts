import { computed } from 'vue';

import { injectStoresManager } from '../../../common';
import { DevicesModuleChannelCategory, DevicesModuleChannelPropertyCategory } from '../../../openapi';
import { ConnectionState } from '../devices.constants';
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

	const state = computed<ConnectionState>((): ConnectionState => {
		const channel =
			channelsStore.findForDevice(device.id).find((channel) => channel.category === DevicesModuleChannelCategory.device_information) || null;

		if (!channel) {
			return ConnectionState.UNKNOWN;
		}

		const property =
			channelsPropertiesStore.findForChannel(channel.id).find((property) => property.category === DevicesModuleChannelPropertyCategory.status) ||
			null;

		if (!property) {
			return ConnectionState.UNKNOWN;
		}

		if (typeof property.value === 'string' && Object.values(ConnectionState).includes(property.value as ConnectionState)) {
			return property.value as ConnectionState;
		}

		return ConnectionState.UNKNOWN;
	});

	const isReady = computed<boolean>((): boolean => {
		return ([ConnectionState.READY, ConnectionState.CONNECTED, ConnectionState.RUNNING] as string[]).includes(state.value);
	});

	return {
		state,
		isReady,
	};
};
