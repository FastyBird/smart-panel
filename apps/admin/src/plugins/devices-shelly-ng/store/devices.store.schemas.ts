import { type ZodType, z } from 'zod';

import { DeviceCreateReqSchema, DeviceResSchema, DeviceSchema, DeviceUpdateReqSchema } from '../../../modules/devices';
import type {
	DevicesShellyNgPluginCreateDeviceSchema,
	DevicesShellyNgPluginUpdateDeviceSchema,
	DevicesShellyNgPluginDeviceSchema,
} from '../../../openapi.constants';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';

type ApiCreateDevice = DevicesShellyNgPluginCreateDeviceSchema;
type ApiUpdateDevice = DevicesShellyNgPluginUpdateDeviceSchema;
type ApiDevice = DevicesShellyNgPluginDeviceSchema;

export const ShellyNgDeviceAddressSchema = z.object({
	id: z.string(),
	interfaceType: z.enum(['ethernet', 'wifi']),
	address: z.string(),
});

export const ShellyNgDeviceSchema = DeviceSchema.extend({
	password: z.string().nullable(),
	canonicalMac: z.string().nullable().optional(),
	hasEthernet: z.boolean().optional(),
	addresses: z.array(ShellyNgDeviceAddressSchema).optional(),
	// Transient fields for address edits — survive store schema validation
	// so they reach transformDeviceUpdateRequest and the API
	wifiAddress: z.string().nullable().optional(),
	ethernetAddress: z.string().nullable().optional(),
});

// BACKEND API (snake_case — matches raw API contract before snakeToCamel transform)
// ===========

// Address schema in API response format (snake_case keys)
const ShellyNgDeviceAddressResSchema = z.object({
	id: z.string(),
	interface_type: z.enum(['ethernet', 'wifi']),
	address: z.string(),
});

export const ShellyNgDeviceCreateReqSchema: ZodType<ApiCreateDevice> = DeviceCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_SHELLY_NG_TYPE),
		password: z.string().nullable(),
		wifi_address: z.string().nullable().optional(),
	})
);

export const ShellyNgDeviceUpdateReqSchema: ZodType<ApiUpdateDevice> = DeviceUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_SHELLY_NG_TYPE),
		category: z.nativeEnum(DevicesModuleDeviceCategory).optional(),
		password: z.string().nullable().optional(),
		wifi_address: z.string().nullable().optional(),
		ethernet_address: z.string().nullable().optional(),
	})
);

export const ShellyNgDeviceResSchema: ZodType<ApiDevice> = DeviceResSchema.and(
	z.object({
		type: z.literal(DEVICES_SHELLY_NG_TYPE),
		password: z.string().nullable(),
		canonical_mac: z.string().nullable().optional(),
		has_ethernet: z.boolean(),
		addresses: z.array(ShellyNgDeviceAddressResSchema).optional().default([]),
	})
);
