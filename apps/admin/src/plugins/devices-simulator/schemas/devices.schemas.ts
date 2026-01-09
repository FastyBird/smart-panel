import { DeviceAddFormSchema, DeviceEditFormSchema } from '../../../modules/devices';

// Simulator devices use the base form schemas without additional fields
export const SimulatorDeviceAddFormSchema = DeviceAddFormSchema;

export const SimulatorDeviceEditFormSchema = DeviceEditFormSchema;
