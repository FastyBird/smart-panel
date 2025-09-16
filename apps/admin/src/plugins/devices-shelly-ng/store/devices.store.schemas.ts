import { type ZodType, z } from 'zod';

import { DeviceCreateReqSchema, DeviceResSchema, DeviceSchema, DeviceUpdateReqSchema } from '../../../modules/devices';
import { DevicesShellyNgPluginShellyNgDeviceType, type components } from '../../../openapi';

type ApiCreateDevice = components['schemas']['DevicesShellyNgPluginCreateShellyNgDevice'];
type ApiUpdateDevice = components['schemas']['DevicesShellyNgPluginUpdateShellyNgDevice'];
type ApiDevice = components['schemas']['DevicesShellyNgPluginShellyNgDevice'];

export const ShellyNgDeviceSchema = DeviceSchema.extend({
	password: z.string().nullable(),
	hostname: z.string().nullable(),
});

// BACKEND API
// ===========

export const ShellyNgDeviceCreateReqSchema: ZodType<ApiCreateDevice> = DeviceCreateReqSchema.and(
	z.object({
		type: z.nativeEnum(DevicesShellyNgPluginShellyNgDeviceType),
		password: z.string().nullable(),
		hostname: z.string().nullable(),
	})
);

export const ShellyNgDeviceUpdateReqSchema: ZodType<ApiUpdateDevice> = DeviceUpdateReqSchema.and(
	z.object({
		type: z.nativeEnum(DevicesShellyNgPluginShellyNgDeviceType),
		password: z.string().nullable(),
		hostname: z.string().nullable(),
	})
);

export const ShellyNgDeviceResSchema: ZodType<ApiDevice> = DeviceResSchema.and(
	z.object({
		type: z.nativeEnum(DevicesShellyNgPluginShellyNgDeviceType),
		password: z.string().nullable(),
		hostname: z.string().nullable(),
	})
);
