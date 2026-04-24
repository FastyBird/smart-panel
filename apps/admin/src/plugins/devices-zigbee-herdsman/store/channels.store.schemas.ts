import { z } from 'zod';

import { ChannelCreateReqSchema, ChannelResSchema, ChannelSchema, ChannelUpdateReqSchema } from '../../../modules/devices';
import { DEVICES_ZIGBEE_HERDSMAN_TYPE } from '../devices-zigbee-herdsman.constants';

export const ZigbeeHerdsmanChannelSchema = ChannelSchema;

// BACKEND API
// ===========

export const ZigbeeHerdsmanChannelCreateReqSchema = ChannelCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_ZIGBEE_HERDSMAN_TYPE),
	})
);

export const ZigbeeHerdsmanChannelUpdateReqSchema = ChannelUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_ZIGBEE_HERDSMAN_TYPE),
	})
);

export const ZigbeeHerdsmanChannelResSchema = ChannelResSchema.and(
	z.object({
		type: z.literal(DEVICES_ZIGBEE_HERDSMAN_TYPE),
	})
);
