import type { IChannelProperty } from '../store/channels.properties.store.types';
import type { IChannel } from '../store/channels.store.types';
import type { IDevice } from '../store/devices.store.types';

export interface IViewChannelPropertyEditProps {
	id: IChannelProperty['id'];
	channelId: IChannel['id'];
	channel?: IChannel;
	device?: IDevice;
	remoteFormChanged?: boolean;
}
