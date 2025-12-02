import { type ZodType, z } from 'zod';

import { ChannelCreateReqSchema, ChannelResSchema, ChannelSchema, ChannelUpdateReqSchema } from '../../../modules/devices';
import type {
	DevicesShellyNgPluginCreateChannelSchema,
	DevicesShellyNgPluginUpdateChannelSchema,
	DevicesShellyNgPluginChannelSchema,
} from '../../../openapi.constants';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';

type ApiCreateChannel = DevicesShellyNgPluginCreateChannelSchema;
type ApiUpdateChannel = DevicesShellyNgPluginUpdateChannelSchema;
type ApiChannel = DevicesShellyNgPluginChannelSchema;

export const ShellyNgChannelSchema = ChannelSchema;

// BACKEND API
// ===========

export const ShellyNgChannelCreateReqSchema: ZodType<ApiCreateChannel> = ChannelCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_SHELLY_NG_TYPE),
	})
);

export const ShellyNgChannelUpdateReqSchema: ZodType<ApiUpdateChannel> = ChannelUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_SHELLY_NG_TYPE),
	})
);

export const ShellyNgChannelResSchema: ZodType<ApiChannel> = ChannelResSchema.and(
	z.object({
		type: z.literal(DEVICES_SHELLY_NG_TYPE),
	})
);
