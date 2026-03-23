import { z } from 'zod';

import { DeviceAddFormSchema, DeviceEditFormSchema } from '../../../modules/devices';
import { DevicesReTerminalPluginVariant } from '../../../openapi.constants';

export const ReTerminalDeviceAddFormSchema = DeviceAddFormSchema.extend({
	variant: z.nativeEnum(DevicesReTerminalPluginVariant).nullable(),
});

export const ReTerminalDeviceEditFormSchema = DeviceEditFormSchema.extend({
	variant: z.nativeEnum(DevicesReTerminalPluginVariant).nullable(),
});
