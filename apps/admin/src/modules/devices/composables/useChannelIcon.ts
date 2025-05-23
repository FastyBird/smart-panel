import { computed } from 'vue';

import { injectStoresManager } from '../../../common';
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
			default:
				return 'mdi:chip';
		}
	});

	return {
		icon,
	};
};
