import { type ZodType, z } from 'zod';

import { DeviceCreateReqSchema, DeviceResSchema, DeviceSchema, DeviceUpdateReqSchema } from '../../../modules/devices';
import type {
	DevicesReTerminalPluginCreateDeviceSchema,
	DevicesReTerminalPluginDeviceSchema,
	DevicesReTerminalPluginUpdateDeviceSchema,
} from '../../../openapi.constants';
import { DevicesModuleDeviceCategory, DevicesReTerminalPluginVariant } from '../../../openapi.constants';
import { DEVICES_RETERMINAL_TYPE } from '../devices-reterminal.constants';

type ApiCreateDevice = DevicesReTerminalPluginCreateDeviceSchema;
type ApiUpdateDevice = DevicesReTerminalPluginUpdateDeviceSchema;
type ApiDevice = DevicesReTerminalPluginDeviceSchema;

export const ReTerminalDeviceSchema = DeviceSchema.extend({
	variant: z.nativeEnum(DevicesReTerminalPluginVariant).nullable(),
});

// BACKEND API
// ===========

export const ReTerminalDeviceCreateReqSchema: ZodType<ApiCreateDevice> = DeviceCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_RETERMINAL_TYPE),
		variant: z.nativeEnum(DevicesReTerminalPluginVariant).optional(),
	})
);

export const ReTerminalDeviceUpdateReqSchema: ZodType<ApiUpdateDevice> = DeviceUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_RETERMINAL_TYPE),
		category: z.nativeEnum(DevicesModuleDeviceCategory).optional(),
		variant: z.nativeEnum(DevicesReTerminalPluginVariant).optional(),
	})
);

export const ReTerminalDeviceResSchema: ZodType<ApiDevice> = DeviceResSchema.and(
	z.object({
		type: z.literal(DEVICES_RETERMINAL_TYPE),
		variant: z.nativeEnum(DevicesReTerminalPluginVariant).optional(),
	})
);
