import { z } from 'zod';

import {
	ShellyV1DeviceAddFormSchema,
	ShellyV1DeviceEditFormSchema,
	ShellyV1DeviceInfoRequestSchema,
	ShellyV1DeviceInfoSchema,
	ShellyV1DiscoveryDeviceSchema,
	ShellyV1DiscoverySessionSchema,
	ShellyV1SupportedDeviceSchema,
} from './devices.schemas';

export type IShellyV1DeviceAddForm = z.infer<typeof ShellyV1DeviceAddFormSchema>;

export type IShellyV1DeviceEditForm = z.infer<typeof ShellyV1DeviceEditFormSchema>;

export type IShellyV1SupportedDevice = z.infer<typeof ShellyV1SupportedDeviceSchema>;

export type IShellyV1DeviceInfoRequest = z.infer<typeof ShellyV1DeviceInfoRequestSchema>;

export type IShellyV1DeviceInfo = z.infer<typeof ShellyV1DeviceInfoSchema>;

export type IShellyV1DiscoveryDevice = z.infer<typeof ShellyV1DiscoveryDeviceSchema>;

export type IShellyV1DiscoverySession = z.infer<typeof ShellyV1DiscoverySessionSchema>;
