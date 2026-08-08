import { DeviceAddFormSchema, DeviceEditFormSchema } from '../../../modules/devices';

// Virtual devices have no device-level field of their own — value_origin and source_property live
// on the channel property, not the device — so the base form schemas are used unmodified.
export const VirtualDeviceAddFormSchema = DeviceAddFormSchema;

export const VirtualDeviceEditFormSchema = DeviceEditFormSchema;
