import type { IChannel } from '../store/channels.store.types';
import type { IDevice } from '../store/devices.store.types';

export interface IViewChannelPropertyAddProps {
	channelId: IChannel['id'];
	channel?: IChannel;
	device?: IDevice;
	remoteFormChanged?: boolean;
}
