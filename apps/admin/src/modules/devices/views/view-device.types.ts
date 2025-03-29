import type { IChannel, IChannelProperty, IDevice } from '../store';

export interface IViewDeviceProps {
	id: IDevice['id'];
	channelId?: IChannel['id'];
	propertyId?: IChannelProperty['id'];
}
