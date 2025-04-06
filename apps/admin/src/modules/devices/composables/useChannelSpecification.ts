import { computed } from 'vue';

import { injectStoresManager } from '../../../common';
import type { DevicesChannelPropertyCategory } from '../../../openapi';
import { DevicesException } from '../devices.exceptions';
import { channelChannelsPropertiesSpecificationMappers } from '../devices.mapping';
import type { IChannel } from '../store/channels.store.types';
import { channelsPropertiesStoreKey, channelsStoreKey } from '../store/keys';

import type { IUseChannelSpecification } from './types';

interface IUseChannelSpecificationProps {
	id: IChannel['id'];
}

export const useChannelSpecification = ({ id }: IUseChannelSpecificationProps): IUseChannelSpecification => {
	const storesManager = injectStoresManager();

	const channelsStore = storesManager.getStore(channelsStoreKey);
	const channelsPropertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

	const getChannel = (id: IChannel['id']): IChannel | null => {
		return channelsStore.findById(id);
	};

	const getChannelSpecification = (
		channel: IChannel
	): { required: DevicesChannelPropertyCategory[]; optional: DevicesChannelPropertyCategory[] } | null => {
		if (!(channel.category in channelChannelsPropertiesSpecificationMappers)) {
			return null;
		}

		return channelChannelsPropertiesSpecificationMappers[channel.category];
	};

	const canAddAnotherProperty = computed<boolean>((): boolean => {
		const channel = getChannel(id);

		if (channel === null) {
			return true;
		}

		const { required, optional } = getChannelSpecification(channel) ?? { required: [], optional: [] };

		const allowedCategories = [...required, ...optional];

		const existingCategories = channelsPropertiesStore.findForChannel(channel.id).map((property) => property.category);

		const remaining = allowedCategories.filter((category) => !existingCategories.includes(category));

		return remaining.length > 0;
	});

	const missingRequiredProperties = computed<DevicesChannelPropertyCategory[]>((): DevicesChannelPropertyCategory[] => {
		const channel = getChannel(id);

		if (channel === null) {
			throw new DevicesException("Something went wrong, channel can't be loaded");
		}

		const { required } = getChannelSpecification(channel) ?? { required: [] };

		const existingCategories = channelsPropertiesStore.findForChannel(channel.id).map((property) => property.category);

		return required.filter((category) => !existingCategories.includes(category));
	});

	return {
		canAddAnotherProperty,
		missingRequiredProperties,
	};
};
