import type { IDevice } from '../store/devices.store.types';

export interface IViewDeviceControlProps {
	id: IDevice['id'];
	device?: IDevice;
}
