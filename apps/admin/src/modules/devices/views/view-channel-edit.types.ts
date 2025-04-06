import type { IChannel } from '../store/channels.store.types';
import type { IDevice } from '../store/devices.store.types';

export interface IViewChannelEditProps {
	id: IChannel['id'];
	device?: IDevice;
	channel?: IChannel;
	remoteFormChanged?: boolean;
}
