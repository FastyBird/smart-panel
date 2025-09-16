import { z } from 'zod';

import { DeviceAddFormSchema, DeviceEditFormSchema } from '../../../modules/devices';

export const ShellyNgDeviceAddFormSchema = DeviceAddFormSchema.extend({
	password: z.string().nullable().optional(),
	hostname: z.string().nullable().optional(),
});

export const ShellyNgDeviceEditFormSchema = DeviceEditFormSchema.extend({
	password: z.string().nullable().optional(),
	hostname: z.string().nullable().optional(),
});
