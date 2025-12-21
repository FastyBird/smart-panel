import { z } from 'zod';

import { DeviceAddFormSchema, DeviceEditFormSchema } from '../../../modules/devices';

export const Zigbee2mqttDeviceAddFormSchema = DeviceAddFormSchema.extend({
	ieeeAddress: z.string().nullable(),
	friendlyName: z.string().nullable(),
	modelId: z.string().nullable(),
});

export const Zigbee2mqttDeviceEditFormSchema = DeviceEditFormSchema.extend({
	ieeeAddress: z.string().nullable(),
	friendlyName: z.string().nullable(),
	modelId: z.string().nullable(),
});
