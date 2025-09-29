import { type ZodType, z } from 'zod';

import { DeviceCreateReqSchema, DeviceResSchema, DeviceSchema, DeviceUpdateReqSchema } from '../../../modules/devices';
import { DevicesModuleDeviceCategory, DevicesShellyNgPluginShellyNgDeviceType, type components } from '../../../openapi';

type ApiCreateDevice = components['schemas']['DevicesShellyNgPluginCreateShellyNgDevice'];
type ApiUpdateDevice = components['schemas']['DevicesShellyNgPluginUpdateShellyNgDevice'];
type ApiDevice = components['schemas']['DevicesShellyNgPluginShellyNgDevice'];

export const ShellyNgDeviceSchema = DeviceSchema.extend({
	password: z.string().nullable(),
	hostname: z.string(),
});

// BACKEND API
// ===========

export const ShellyNgDeviceCreateReqSchema: ZodType<ApiCreateDevice> = DeviceCreateReqSchema.and(
	z.object({
		type: z.nativeEnum(DevicesShellyNgPluginShellyNgDeviceType),
		password: z.string().nullable(),
		hostname: z.string(),
	})
);

export const ShellyNgDeviceUpdateReqSchema: ZodType<ApiUpdateDevice> = DeviceUpdateReqSchema.and(
	z.object({
		type: z.nativeEnum(DevicesShellyNgPluginShellyNgDeviceType),
		category: z.nativeEnum(DevicesModuleDeviceCategory).optional(),
		password: z.string().nullable().optional(),
		hostname: z.string().optional(),
	})
);

export const ShellyNgDeviceResSchema: ZodType<ApiDevice> = DeviceResSchema.and(
	z.object({
		type: z.nativeEnum(DevicesShellyNgPluginShellyNgDeviceType),
		password: z.string().nullable(),
		hostname: z.string(),
	})
);
