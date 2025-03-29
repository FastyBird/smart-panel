import type { IChannel, IDevice } from '../store';

export interface IViewChannelEditProps {
	id: IChannel['id'];
	device?: IDevice;
	channel?: IChannel;
	remoteFormChanged?: boolean;
}
