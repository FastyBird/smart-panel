import type { IDevice } from '../store';

export interface IViewDeviceEditProps {
	id: IDevice['id'];
	device?: IDevice;
	remoteFormChanged?: boolean;
}
