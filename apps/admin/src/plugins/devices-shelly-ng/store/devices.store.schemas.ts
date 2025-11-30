import { type ZodType, z } from 'zod';

import { DeviceCreateReqSchema, DeviceResSchema, DeviceSchema, DeviceUpdateReqSchema } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { type components } from '../../../openapi';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';

type ApiCreateDevice = components['schemas']['DevicesShellyNgPluginDataDevice'];
type ApiUpdateDevice = components['schemas']['DevicesShellyNgPluginDataDevice'];
type ApiDevice = components['schemas']['DevicesShellyNgPluginDataDevice'];

export const ShellyNgDeviceSchema = DeviceSchema.extend({
	password: z.string().nullable(),
	hostname: z.string(),
});

// BACKEND API
// ===========

export const ShellyNgDeviceCreateReqSchema: ZodType<ApiCreateDevice> = DeviceCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_SHELLY_NG_TYPE),
		password: z.string().nullable(),
		hostname: z.string(),
	})
);

export const ShellyNgDeviceUpdateReqSchema: ZodType<ApiUpdateDevice> = DeviceUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_SHELLY_NG_TYPE),
		category: z.nativeEnum(DevicesModuleDeviceCategory).optional(),
		password: z.string().nullable().optional(),
		hostname: z.string().optional(),
	})
);

export const ShellyNgDeviceResSchema: ZodType<ApiDevice> = DeviceResSchema.and(
	z.object({
		type: z.literal(DEVICES_SHELLY_NG_TYPE),
		password: z.string().nullable(),
		hostname: z.string(),
	})
);
