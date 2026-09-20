import { computed } from 'vue';

import { injectStoresManager } from '../../../common';
import { DevicesModuleChannelPropertyCategory } from '../../../openapi.constants';
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
			case DevicesModuleChannelPropertyCategory.event:
				return 'mdi:bell-ring-outline';
			case DevicesModuleChannelPropertyCategory.detected:
				return 'mdi:record-circle-outline';
			case DevicesModuleChannelPropertyCategory.unit:
				return 'mdi:ruler';
			case DevicesModuleChannelPropertyCategory.value:
				return 'mdi:numeric';
			default:
				return 'mdi:tune';
		}
	});

	return {
		icon,
	};
};
