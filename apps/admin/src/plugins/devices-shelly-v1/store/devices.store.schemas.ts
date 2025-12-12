import { z } from 'zod';

import { DeviceCreateReqSchema, DeviceResSchema, DeviceSchema, DeviceUpdateReqSchema } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';

export const ShellyV1DeviceSchema = DeviceSchema.extend({
	password: z.string().nullable(),
	hostname: z.string(),
});

// BACKEND API
// ===========

export const ShellyV1DeviceCreateReqSchema = DeviceCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_SHELLY_V1_TYPE),
		password: z.string().nullable(),
		hostname: z.string(),
	})
);

export const ShellyV1DeviceUpdateReqSchema = DeviceUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_SHELLY_V1_TYPE),
		category: z.nativeEnum(DevicesModuleDeviceCategory).optional(),
		password: z.string().nullable().optional(),
		hostname: z.string().optional(),
	})
);

export const ShellyV1DeviceResSchema = DeviceResSchema.and(
	z.object({
		type: z.literal(DEVICES_SHELLY_V1_TYPE),
		password: z.string().nullable(),
		hostname: z.string(),
	})
);
