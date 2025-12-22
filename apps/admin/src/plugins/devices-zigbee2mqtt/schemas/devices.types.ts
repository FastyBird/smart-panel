import type { z } from 'zod';

import type {
	Zigbee2mqttDeviceAddFormSchema,
	Zigbee2mqttDeviceAddMultiStepFormSchema,
	Zigbee2mqttDeviceEditFormSchema,
} from './devices.schemas';

export type IZigbee2mqttDeviceAddForm = z.infer<typeof Zigbee2mqttDeviceAddFormSchema>;
export type IZigbee2mqttDeviceEditForm = z.infer<typeof Zigbee2mqttDeviceEditFormSchema>;
export type IZigbee2mqttDeviceAddMultiStepForm = z.infer<typeof Zigbee2mqttDeviceAddMultiStepFormSchema>;
