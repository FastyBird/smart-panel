import { z } from 'zod';

import { DeviceAddFormSchema, DeviceEditFormSchema } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';

export const Zigbee2mqttDeviceAddFormSchema = DeviceAddFormSchema;

export const Zigbee2mqttDeviceEditFormSchema = DeviceEditFormSchema;

/**
 * Schema for the multi-step device add form
 */
export const Zigbee2mqttDeviceAddMultiStepFormSchema = z.object({
	id: z.string().uuid(),
	type: z.string(),
	ieeeAddress: z.string().min(1),
	name: z.string().min(1),
	category: z.nativeEnum(DevicesModuleDeviceCategory),
	description: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	enabled: z.boolean().default(true),
});
