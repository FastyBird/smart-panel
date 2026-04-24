import { z } from 'zod';

import {
	ChannelPropertyCreateReqSchema,
	ChannelPropertyResSchema,
	ChannelPropertySchema,
	ChannelPropertyUpdateReqSchema,
} from '../../../modules/devices';
import { DEVICES_ZIGBEE_HERDSMAN_TYPE } from '../devices-zigbee-herdsman.constants';

export const ZigbeeHerdsmanChannelPropertySchema = ChannelPropertySchema;

// BACKEND API
// ===========

export const ZigbeeHerdsmanChannelPropertyCreateReqSchema = ChannelPropertyCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_ZIGBEE_HERDSMAN_TYPE),
	})
);

export const ZigbeeHerdsmanChannelPropertyUpdateReqSchema = ChannelPropertyUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_ZIGBEE_HERDSMAN_TYPE),
	})
);

export const ZigbeeHerdsmanChannelPropertyResSchema = ChannelPropertyResSchema.and(
	z.object({
		type: z.literal(DEVICES_ZIGBEE_HERDSMAN_TYPE),
	})
);
