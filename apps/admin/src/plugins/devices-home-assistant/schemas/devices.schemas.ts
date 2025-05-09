import { z } from 'zod';

import { DeviceAddFormSchema, DeviceEditFormSchema } from '../../../modules/devices';

export const HomeAssistantDeviceAddFormSchema = DeviceAddFormSchema.extend({
	haDeviceId: z.string(),
});

export const HomeAssistantDeviceEditFormSchema = DeviceEditFormSchema.extend({
	haDeviceId: z.string().optional(),
});
