import type { IChannelProperty } from '../store/channels.properties.store.types';
import type { IChannel } from '../store/channels.store.types';
import type { IDevice } from '../store/devices.store.types';

export interface IViewDeviceProps {
	id: IDevice['id'];
	channelId?: IChannel['id'];
	propertyId?: IChannelProperty['id'];
}
