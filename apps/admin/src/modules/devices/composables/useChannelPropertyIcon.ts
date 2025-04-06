import { computed } from 'vue';

import { injectStoresManager } from '../../../common';
import type { IChannelProperty } from '../store/channels.properties.store.types';
import { channelsPropertiesStoreKey } from '../store/keys';

import type { IUseChannelPropertyIcon } from './types';

interface IUseChannelPropertyIconProps {
	id: IChannelProperty['id'];
}

export const useChannelPropertyIcon = ({ id }: IUseChannelPropertyIconProps): IUseChannelPropertyIcon => {
	const storesManager = injectStoresManager();

	const propertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

	const icon = computed<string>((): string => {
		const property = propertiesStore.findById(id);

		switch (property?.category) {
			default:
				return 'mdi:tune';
		}
	});

	return {
		icon,
	};
};
