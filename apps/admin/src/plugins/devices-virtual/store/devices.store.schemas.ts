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

export const VirtualDeviceModeSchema = z.enum(['projection', 'sensor_aggregate', 'actuator_group', 'climate_controller', 'sensor_transform']);
const AuthorableVirtualDeviceModeSchema = z.enum(['projection', 'sensor_aggregate', 'actuator_group']);

export const VirtualDeviceSchema = DeviceSchema.extend({
	mode: VirtualDeviceModeSchema.default('projection'),
});

// BACKEND API
// ===========

export const VirtualDeviceCreateReqSchema: ZodType<ApiCreateDevice> = DeviceCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_VIRTUAL_TYPE),
		mode: AuthorableVirtualDeviceModeSchema.optional(),
	})
);

export const VirtualDeviceUpdateReqSchema: ZodType<ApiUpdateDevice> = DeviceUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_VIRTUAL_TYPE),
		mode: AuthorableVirtualDeviceModeSchema.optional(),
	})
);

export const VirtualDeviceResSchema: ZodType<ApiDevice> = DeviceResSchema.and(
	z.object({
		type: z.literal(DEVICES_VIRTUAL_TYPE),
		mode: VirtualDeviceModeSchema.default('projection'),
	})
);
