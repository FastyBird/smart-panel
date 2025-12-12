import { z } from 'zod';

import { ChannelCreateReqSchema, ChannelResSchema, ChannelSchema, ChannelUpdateReqSchema } from '../../../modules/devices';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';

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

export const ShellyV1ChannelResSchema = ChannelResSchema.and(
	z.object({
		type: z.literal(DEVICES_SHELLY_V1_TYPE),
	})
);
