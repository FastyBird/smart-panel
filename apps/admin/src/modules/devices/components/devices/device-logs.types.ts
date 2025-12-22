import type { IDevice } from '../../store/devices.store.types';

export interface IDeviceLogsProps {
	deviceId: IDevice['id'];
	live?: boolean;
}
