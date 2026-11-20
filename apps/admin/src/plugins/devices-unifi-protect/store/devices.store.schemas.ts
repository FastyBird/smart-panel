import { type ZodType, z } from 'zod';

import { DeviceCreateReqSchema, DeviceResSchema, DeviceSchema, DeviceUpdateReqSchema } from '../../../modules/devices';
import type {
	DevicesUnifiProtectPluginCreateDeviceSchema,
	DevicesUnifiProtectPluginDeviceSchema,
	DevicesUnifiProtectPluginUpdateDeviceSchema,
} from '../../../openapi.constants';
import { DEVICES_UNIFI_PROTECT_TYPE } from '../devices-unifi-protect.constants';

export const ProtectDeviceSchema = DeviceSchema;

export const ProtectDeviceCreateReqSchema: ZodType<DevicesUnifiProtectPluginCreateDeviceSchema> = DeviceCreateReqSchema.and(
	z.object({ type: z.literal(DEVICES_UNIFI_PROTECT_TYPE) })
);

export const ProtectDeviceUpdateReqSchema: ZodType<DevicesUnifiProtectPluginUpdateDeviceSchema> = DeviceUpdateReqSchema.and(
	z.object({ type: z.literal(DEVICES_UNIFI_PROTECT_TYPE) })
);

export const ProtectDeviceResSchema: ZodType<DevicesUnifiProtectPluginDeviceSchema> = DeviceResSchema.and(
	z.object({ type: z.literal(DEVICES_UNIFI_PROTECT_TYPE) })
);
