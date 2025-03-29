import { computed } from 'vue';

import { injectStoresManager } from '../../../common';
import { DevicesChannelCategory, DevicesChannelPropertyCategory } from '../../../openapi';
import { ConnectionState } from '../devices.constants';
import { type IDevice, channelsPropertiesStoreKey, channelsStoreKey } from '../store';

import type { IUseDeviceState } from './types';

export function useDeviceState(device: IDevice): IUseDeviceState {
	const storesManager = injectStoresManager();

	const channelsStore = storesManager.getStore(channelsStoreKey);

	const channelsPropertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

	const state = computed<ConnectionState>((): ConnectionState => {
		const channel = channelsStore.findForDevice(device.id).find((channel) => channel.category === DevicesChannelCategory.device_information) || null;

		if (!channel) {
			return ConnectionState.UNKNOWN;
		}

		const property =
			channelsPropertiesStore.findForChannel(channel.id).find((property) => property.category === DevicesChannelPropertyCategory.status) || null;

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
}
