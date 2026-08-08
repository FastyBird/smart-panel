import { type ZodType, z } from 'zod';

import { DeviceCreateReqSchema, DeviceResSchema, DeviceSchema, DeviceUpdateReqSchema } from '../../../modules/devices';
import type {
	DevicesVirtualPluginCreateDeviceSchema,
	DevicesVirtualPluginDeviceSchema,
	DevicesVirtualPluginUpdateDeviceSchema,
} from '../../../openapi.constants';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';

type ApiCreateDevice = DevicesVirtualPluginCreateDeviceSchema;
type ApiUpdateDevice = DevicesVirtualPluginUpdateDeviceSchema;
type ApiDevice = DevicesVirtualPluginDeviceSchema;

// Virtual devices have no device-level field of their own, so the base device store schema is used
// unmodified.
export const VirtualDeviceSchema = DeviceSchema;

// BACKEND API
// ===========

export const VirtualDeviceCreateReqSchema: ZodType<ApiCreateDevice> = DeviceCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_VIRTUAL_TYPE),
	})
);

export const VirtualDeviceUpdateReqSchema: ZodType<ApiUpdateDevice> = DeviceUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_VIRTUAL_TYPE),
	})
);

export const VirtualDeviceResSchema: ZodType<ApiDevice> = DeviceResSchema.and(
	z.object({
		type: z.literal(DEVICES_VIRTUAL_TYPE),
	})
);
