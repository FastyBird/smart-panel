import { z } from 'zod';

import {
	ChannelPropertyCreateReqSchema,
	ChannelPropertyResSchema,
	ChannelPropertySchema,
	ChannelPropertyUpdateReqSchema,
} from '../../../modules/devices';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';

export const ShellyV1ChannelPropertySchema = ChannelPropertySchema;

// BACKEND API
// ===========

export const ShellyV1ChannelPropertyCreateReqSchema = ChannelPropertyCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_SHELLY_V1_TYPE),
	})
);

export const ShellyV1ChannelPropertyUpdateReqSchema = ChannelPropertyUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_SHELLY_V1_TYPE),
	})
);

export const ShellyV1ChannelPropertyResSchema = ChannelPropertyResSchema.and(
	z.object({
		type: z.literal(DEVICES_SHELLY_V1_TYPE),
	})
);
