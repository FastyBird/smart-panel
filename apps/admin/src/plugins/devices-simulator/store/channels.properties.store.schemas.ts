import { type ZodType, z } from 'zod';

import {
	ChannelPropertyCreateReqSchema,
	ChannelPropertyResSchema,
	ChannelPropertySchema,
	ChannelPropertyUpdateReqSchema,
} from '../../../modules/devices';
import { DEVICES_SIMULATOR_TYPE } from '../devices-simulator.constants';

export const SimulatorChannelPropertySchema = ChannelPropertySchema;

// BACKEND API
// ===========

export const SimulatorChannelPropertyCreateReqSchema: ZodType = ChannelPropertyCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_SIMULATOR_TYPE),
	})
);

export const SimulatorChannelPropertyUpdateReqSchema: ZodType = ChannelPropertyUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_SIMULATOR_TYPE),
	})
);

export const SimulatorChannelPropertyResSchema: ZodType = ChannelPropertyResSchema.and(
	z.object({
		type: z.literal(DEVICES_SIMULATOR_TYPE),
	})
);
