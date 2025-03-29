import type { IChannel, IChannelProperty, IDevice } from '../store';

export interface IViewChannelPropertyEditProps {
	id: IChannelProperty['id'];
	channelId: IChannel['id'];
	channel?: IChannel;
	device?: IDevice;
	remoteFormChanged?: boolean;
}
