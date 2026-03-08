import { type ZodType, z } from 'zod';

import { DeviceCreateReqSchema, DeviceResSchema, DeviceSchema, DeviceUpdateReqSchema } from '../../../modules/devices';
import type {
	DevicesWledPluginCreateDeviceSchema,
	DevicesWledPluginUpdateDeviceSchema,
	DevicesWledPluginDeviceSchema,
} from '../../../openapi.constants';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { DEVICES_WLED_TYPE } from '../devices-wled.constants';

type ApiCreateDevice = DevicesWledPluginCreateDeviceSchema;
type ApiUpdateDevice = DevicesWledPluginUpdateDeviceSchema;
type ApiDevice = DevicesWledPluginDeviceSchema;

export const WledDeviceSchema = DeviceSchema.extend({
	hostname: z.string(),
});

// BACKEND API
// ===========

export const WledDeviceCreateReqSchema: ZodType<ApiCreateDevice> = DeviceCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_WLED_TYPE),
		hostname: z.string(),
	})
);

export const WledDeviceUpdateReqSchema: ZodType<ApiUpdateDevice> = DeviceUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_WLED_TYPE),
		category: z.nativeEnum(DevicesModuleDeviceCategory).optional(),
		hostname: z.string().optional(),
	})
);

export const WledDeviceResSchema: ZodType<ApiDevice> = DeviceResSchema.and(
	z.object({
		type: z.literal(DEVICES_WLED_TYPE),
		hostname: z.string(),
	})
);
