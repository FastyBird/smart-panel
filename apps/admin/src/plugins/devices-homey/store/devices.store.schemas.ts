import { type ZodType, z } from 'zod';

import { DeviceCreateReqSchema, DeviceResSchema, DeviceSchema, DeviceUpdateReqSchema } from '../../../modules/devices';
import type {
	DevicesHomeyPluginCreateDeviceSchema,
	DevicesHomeyPluginDeviceSchema,
	DevicesHomeyPluginUpdateDeviceSchema,
} from '../../../openapi.constants';
import { DEVICES_HOMEY_TYPE } from '../devices-homey.constants';

export const HomeyDeviceSchema = DeviceSchema;

export const HomeyDeviceCreateReqSchema: ZodType<DevicesHomeyPluginCreateDeviceSchema> = DeviceCreateReqSchema.and(
	z.object({ type: z.literal(DEVICES_HOMEY_TYPE) })
);

export const HomeyDeviceUpdateReqSchema: ZodType<DevicesHomeyPluginUpdateDeviceSchema> = DeviceUpdateReqSchema.and(
	z.object({ type: z.literal(DEVICES_HOMEY_TYPE) })
);

export const HomeyDeviceResSchema: ZodType<DevicesHomeyPluginDeviceSchema> = DeviceResSchema.and(z.object({ type: z.literal(DEVICES_HOMEY_TYPE) }));
