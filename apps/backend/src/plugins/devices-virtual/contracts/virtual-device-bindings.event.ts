import { DEVICE_BINDINGS_CHANGED, DeviceBindingsEvent } from '../../../modules/devices/contracts/device-bindings.event';
import { DEVICES_VIRTUAL_PLUGIN_NAME } from '../devices-virtual.constants';

export const VIRTUAL_DEVICE_BINDINGS_CHANGED = DEVICE_BINDINGS_CHANGED;

export interface VirtualDeviceBindingsEvent extends DeviceBindingsEvent {
	readonly producer: typeof DEVICES_VIRTUAL_PLUGIN_NAME;
	readonly kind: 'thermostat';
}
