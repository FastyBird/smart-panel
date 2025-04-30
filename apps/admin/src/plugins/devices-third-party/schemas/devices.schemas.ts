import { z } from 'zod';

import { DeviceAddFormSchema, DeviceEditFormSchema } from '../../../modules/devices';

export const ThirdPartyDeviceAddFormSchema = DeviceAddFormSchema.extend({
	serviceAddress: z.string().url(),
});

export const ThirdPartyDeviceEditFormSchema = DeviceEditFormSchema.extend({
	serviceAddress: z.string().url().optional(),
});
