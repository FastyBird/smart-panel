import { z } from 'zod';

import { DeviceAddFormSchema, DeviceEditFormSchema } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';

export const ShellyV1DeviceAddFormSchema = DeviceAddFormSchema.extend({
	password: z.string().nullable().optional(),
	hostname: z.string().trim().nonempty(),
});

export const ShellyV1DeviceEditFormSchema = DeviceEditFormSchema.extend({
	password: z.string().nullable().optional(),
	hostname: z.string().trim().nonempty(),
});

export const ShellyV1SupportedDeviceSchema = z.object({
	group: z.string(),
	name: z.string(),
	models: z.array(z.string()),
	categories: z.array(z.nativeEnum(DevicesModuleDeviceCategory)),
});

export const ShellyV1DeviceInfoRequestSchema = z.object({
	hostname: z.string(),
	password: z.string().nullable().optional(),
});

export const ShellyV1DeviceInfoSchema = z.object({
	reachable: z.boolean(),
	authRequired: z.boolean(),
	authValid: z.boolean(),
	host: z.string(),
	ip: z.string(),
	mac: z.string(),
	model: z.string(),
	firmware: z.string(),
	deviceType: z.string(),
});
