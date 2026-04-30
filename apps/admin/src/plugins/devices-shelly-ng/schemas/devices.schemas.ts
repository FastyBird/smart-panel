import { z } from 'zod';

import { DeviceAddFormSchema, DeviceEditFormSchema } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';

export const ShellyNgDeviceAddFormSchema = DeviceAddFormSchema.extend({
	password: z.string().nullable().optional(),
	hostname: z.string().trim().nonempty(),
});

const emptyToNull = z
	.string()
	.trim()
	.transform((v) => (v === '' ? null : v))
	.nullable()
	.optional();

export const ShellyNgDeviceEditFormSchema = DeviceEditFormSchema.extend({
	password: z.string().nullable().optional(),
	wifiAddress: emptyToNull,
	ethernetAddress: emptyToNull,
}).refine(
	(data) => {
		// Only enforce "at least one address" when address fields are present in the form.
		// When both are undefined (not part of the edit), skip — existing server-side addresses are unchanged.
		if (data.wifiAddress === undefined && data.ethernetAddress === undefined) return true;

		return !!data.wifiAddress || !!data.ethernetAddress;
	},
	{
		message: 'At least one network address (WiFi or Ethernet) is required',
		path: ['wifiAddress'],
	}
);

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

export const ShellyNgDiscoveryDeviceSchema = z.object({
	identifier: z.string().nullable(),
	hostname: z.string(),
	name: z.string().nullable(),
	model: z.string().nullable(),
	displayName: z.string().nullable(),
	firmware: z.string().nullable(),
	status: z.enum(['checking', 'ready', 'needs_password', 'already_registered', 'unsupported', 'failed']),
	source: z.enum(['mdns', 'manual']),
	categories: z.array(z.nativeEnum(DevicesModuleDeviceCategory)),
	suggestedCategory: z.nativeEnum(DevicesModuleDeviceCategory).nullable(),
	authentication: z.object({
		enabled: z.boolean(),
		domain: z.string().nullable().optional(),
	}),
	registeredDeviceId: z.string().nullable(),
	registeredDeviceName: z.string().nullable(),
	registeredDeviceCategory: z.nativeEnum(DevicesModuleDeviceCategory).nullable(),
	error: z.string().nullable(),
	lastSeenAt: z.string(),
});

export const ShellyNgDiscoverySessionSchema = z.object({
	id: z.string(),
	status: z.enum(['running', 'finished', 'failed']),
	startedAt: z.string(),
	expiresAt: z.string(),
	remainingSeconds: z.number(),
	devices: z.array(ShellyNgDiscoveryDeviceSchema),
});
