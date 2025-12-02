import { z } from 'zod';

import { DeviceAddFormSchema, DeviceEditFormSchema } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';

export const ShellyNgDeviceAddFormSchema = DeviceAddFormSchema.extend({
	password: z.string().nullable().optional(),
	hostname: z.string().trim().nonempty(),
});

export const ShellyNgDeviceEditFormSchema = DeviceEditFormSchema.extend({
	password: z.string().nullable().optional(),
	hostname: z.string().trim().nonempty(),
});

export const ShellyNgSupportedDeviceSchema = z.object({
	group: z.string(),
	name: z.string(),
	models: z.array(z.string()),
	categories: z.array(z.nativeEnum(DevicesModuleDeviceCategory)),
	components: z.array(
		z.object({
			type: z.string(),
			ids: z.array(z.number()),
		})
	),
	system: z.array(
		z.object({
			type: z.string(),
		})
	),
});

export const ShellyNgDeviceInfoRequestSchema = z.object({
	hostname: z.string(),
	password: z.string().nullable().optional(),
});

export const ShellyNgDeviceInfoSchema = z.object({
	id: z.string(),
	name: z.string().nullable(),
	mac: z.string(),
	model: z.string(),
	firmware: z.string(),
	app: z.string(),
	profile: z.string().optional(),
	authentication: z.object({
		domain: z.string().nullable().optional(),
		enabled: z.boolean(),
	}),
	discoverable: z.boolean(),
	components: z.array(
		z.object({
			type: z.string(),
			ids: z.array(z.number()),
		})
	),
});
