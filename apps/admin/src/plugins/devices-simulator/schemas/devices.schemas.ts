import { DeviceAddFormSchema, DeviceEditFormSchema } from '../../../modules/devices';
import { DEVICES_SIMULATOR_TYPE } from '../devices-simulator.constants';

export const SimulatorDeviceAddFormSchema = DeviceAddFormSchema.extend({
	type: DeviceAddFormSchema.shape.type.default(DEVICES_SIMULATOR_TYPE),
});

export const SimulatorDeviceEditFormSchema = DeviceEditFormSchema.extend({
	type: DeviceEditFormSchema.shape.type.default(DEVICES_SIMULATOR_TYPE),
});
