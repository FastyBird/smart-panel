import { computed } from 'vue';

import { injectStoresManager } from '../../../common';
import { type IChannelProperty, channelsPropertiesStoreKey } from '../store';

import type { IUseChannelPropertyIcon } from './types';

export function useChannelPropertyIcon(id: IChannelProperty['id']): IUseChannelPropertyIcon {
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
}
