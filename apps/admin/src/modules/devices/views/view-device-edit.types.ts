import type { IDevice } from '../store/devices.store.types';

export interface IViewDeviceEditProps {
	id: IDevice['id'];
	device?: IDevice;
	remoteFormChanged?: boolean;
}
