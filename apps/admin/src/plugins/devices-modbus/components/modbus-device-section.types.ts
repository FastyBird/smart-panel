import type { IDevice } from '../../../modules/devices';
import type { ModbusDeviceBinding } from '../lib/device-points';

export interface IModbusDeviceSectionProps {
	device: IDevice;
}

export type IModbusDeviceBinding = ModbusDeviceBinding;

export interface IModbusBindingReading {
	raw: (number | boolean)[] | null;
	value: string | number | boolean | null;
	error: string | null;
}
