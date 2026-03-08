import { z } from 'zod';

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

export const SimulatorChannelPropertyCreateReqSchema= ChannelPropertyCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_SIMULATOR_TYPE),
	})
);

export const SimulatorChannelPropertyUpdateReqSchema= ChannelPropertyUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_SIMULATOR_TYPE),
	})
);

export const SimulatorChannelPropertyResSchema= ChannelPropertyResSchema.and(
	z.object({
		type: z.literal(DEVICES_SIMULATOR_TYPE),
	})
);
