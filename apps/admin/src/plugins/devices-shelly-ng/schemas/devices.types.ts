import { z } from 'zod';

import {
	ShellyNgDeviceAddFormSchema,
	ShellyNgDeviceEditFormSchema,
	ShellyNgDeviceInfoRequestSchema,
	ShellyNgDeviceInfoSchema,
	ShellyNgSupportedDeviceSchema,
} from './devices.schemas';

export type IShellyNgDeviceAddForm = z.infer<typeof ShellyNgDeviceAddFormSchema>;

export type IShellyNgDeviceEditForm = z.infer<typeof ShellyNgDeviceEditFormSchema>;

export type IShellyNgSupportedDevice = z.infer<typeof ShellyNgSupportedDeviceSchema>;

export type IShellyNgDeviceInfoRequest = z.infer<typeof ShellyNgDeviceInfoRequestSchema>;

export type IShellyNgDeviceInfo = z.infer<typeof ShellyNgDeviceInfoSchema>;
