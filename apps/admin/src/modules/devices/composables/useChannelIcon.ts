import { computed } from 'vue';

import { injectStoresManager } from '../../../common';
import { DevicesModuleChannelCategory } from '../../../openapi.constants';
import type { IChannel } from '../store/channels.store.types';
import { channelsStoreKey } from '../store/keys';

import type { IUseChannelIcon } from './types';

interface IUseChannelIconProps {
	id: IChannel['id'];
}

export const useChannelIcon = ({ id }: IUseChannelIconProps): IUseChannelIcon => {
	const storesManager = injectStoresManager();

	const channelsStore = storesManager.getStore(channelsStoreKey);

	const icon = computed<string>((): string => {
		const channel = channelsStore.findById(id);

		switch (channel?.category) {
			case DevicesModuleChannelCategory.button:
				return 'mdi:gesture-tap-button';
			case DevicesModuleChannelCategory.binary_input:
				return 'mdi:toggle-switch';
			case DevicesModuleChannelCategory.analog_input:
				return 'mdi:tune-vertical';
			default:
				return 'mdi:chip';
		}
	});

	return {
		icon,
	};
};
