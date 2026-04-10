import { type ZodType, z } from 'zod';

import { ChannelCreateReqSchema, ChannelResSchema, ChannelSchema, ChannelUpdateReqSchema } from '../../../modules/devices';
import type { DevicesShellyV1PluginChannelSchema } from '../../../openapi.constants';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';

type ApiChannel = DevicesShellyV1PluginChannelSchema;

export const ShellyV1ChannelSchema = ChannelSchema;

// BACKEND API
// ===========

export const ShellyV1ChannelCreateReqSchema = ChannelCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_SHELLY_V1_TYPE),
	})
);

export const ShellyV1ChannelUpdateReqSchema = ChannelUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_SHELLY_V1_TYPE),
	})
);

export const ShellyV1ChannelResSchema: ZodType<ApiChannel> = ChannelResSchema.and(
	z.object({
		type: z.literal(DEVICES_SHELLY_V1_TYPE),
	})
);
