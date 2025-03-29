import type { IChannel, IDevice } from '../store';

export interface IViewChannelPropertyAddProps {
	channelId: IChannel['id'];
	channel?: IChannel;
	device?: IDevice;
	remoteFormChanged?: boolean;
}
