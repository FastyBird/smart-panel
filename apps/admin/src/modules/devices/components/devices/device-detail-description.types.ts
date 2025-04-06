import type { IChannel } from '../../store/channels.store.types';
import type { IDevice } from '../../store/devices.store.types';

export interface IDeviceDetailDescriptionProps {
	device: IDevice;
	channel: IChannel;
}
