import { z } from 'zod';

import { DeviceAddFormSchema, DeviceEditFormSchema } from '../../../modules/devices';

export const WledDeviceAddFormSchema = DeviceAddFormSchema.extend({
	hostname: z.string().trim().nonempty(),
});

export const WledDeviceEditFormSchema = DeviceEditFormSchema.extend({
	hostname: z.string().trim().nonempty(),
});
