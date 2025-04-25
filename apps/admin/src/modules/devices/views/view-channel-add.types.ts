import type { IDevice } from '../store/devices.store.types';

export interface IViewChannelAddProps {
	device?: IDevice;
	remoteFormChanged?: boolean;
}
