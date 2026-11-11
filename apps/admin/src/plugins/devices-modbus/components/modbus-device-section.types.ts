import type { IDevice } from '../../../modules/devices';
import type { DevicesModbusPluginBindingRole } from '../../../openapi.constants';
import type { ModbusPointBinding } from '../lib/points';

export interface IModbusDeviceSectionProps {
	device: IDevice;
}

export interface IModbusDeviceBinding {
	id: string;
	propertyId: string;
	role: DevicesModbusPluginBindingRole;
	binding: ModbusPointBinding;
}

export interface IModbusBindingReading {
	raw: (number | boolean)[] | null;
	value: string | number | boolean | null;
	error: string | null;
}
