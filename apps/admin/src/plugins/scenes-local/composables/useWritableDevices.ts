import { injectStoresManager } from '../../../common';
import type { IChannel, IChannelProperty, IDevice } from '../../../modules/devices';
import { channelsPropertiesStoreKey, channelsStoreKey } from '../../../modules/devices/store/keys';
import { DevicesModuleChannelPropertyPermissions } from '../../../openapi.constants';

interface IUseWritableDevices {
	isPropertyWritable: (property: IChannelProperty) => boolean;
	hasWritableProperties: (channelId: IChannel['id']) => boolean;
	hasWritableChannels: (deviceId: IDevice['id']) => boolean;
	getWritableProperties: (channelId: IChannel['id']) => IChannelProperty[];
	getChannelsWithWritableProperties: (deviceId: IDevice['id']) => IChannel[];
}

export const useWritableDevices = (): IUseWritableDevices => {
	const storesManager = injectStoresManager();
	const channelsStore = storesManager.getStore(channelsStoreKey);
	const channelsPropertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

	const isPropertyWritable = (property: IChannelProperty): boolean => {
		return (
			property.permissions.includes(DevicesModuleChannelPropertyPermissions.rw) ||
			property.permissions.includes(DevicesModuleChannelPropertyPermissions.wo)
		);
	};

	const getWritableProperties = (channelId: IChannel['id']): IChannelProperty[] => {
		const channelProperties = channelsPropertiesStore.findForChannel(channelId);
		return channelProperties.filter(isPropertyWritable);
	};

	const hasWritableProperties = (channelId: IChannel['id']): boolean => {
		const channelProperties = channelsPropertiesStore.findForChannel(channelId);
		return channelProperties.some(isPropertyWritable);
	};

	const getChannelsWithWritableProperties = (deviceId: IDevice['id']): IChannel[] => {
		const deviceChannels = channelsStore.findForDevice(deviceId);
		return deviceChannels.filter((channel) => hasWritableProperties(channel.id));
	};

	const hasWritableChannels = (deviceId: IDevice['id']): boolean => {
		return getChannelsWithWritableProperties(deviceId).length > 0;
	};

	return {
		isPropertyWritable,
		hasWritableProperties,
		hasWritableChannels,
		getWritableProperties,
		getChannelsWithWritableProperties,
	};
};
