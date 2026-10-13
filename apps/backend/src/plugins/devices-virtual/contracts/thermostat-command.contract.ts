import type { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';

/** Controller command port; importing the projection platform must not register integration entities. */
export interface VirtualThermostatCommandHandler {
	command(updates: readonly IDevicePropertyData[]): Promise<boolean>;
}
