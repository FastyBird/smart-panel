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

export const ShellyV1DiscoveryDeviceSchema = z.object({
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
		valid: z.boolean().nullable().optional(),
	}),
	registeredDeviceId: z.string().nullable(),
	registeredDeviceName: z.string().nullable(),
	registeredDeviceCategory: z.nativeEnum(DevicesModuleDeviceCategory).nullable(),
	error: z.string().nullable(),
	lastSeenAt: z.string(),
});

export const ShellyV1DiscoverySessionSchema = z.object({
	id: z.string(),
	status: z.enum(['running', 'finished', 'failed']),
	startedAt: z.string(),
	expiresAt: z.string(),
	remainingSeconds: z.number(),
	devices: z.array(ShellyV1DiscoveryDeviceSchema),
});
