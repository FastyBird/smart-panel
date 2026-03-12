import { z } from 'zod';

import { ChannelCreateReqSchema, ChannelResSchema, ChannelSchema, ChannelUpdateReqSchema } from '../../../modules/devices';
import { SIMULATOR_TYPE } from '../simulator.constants';

export const SimulatorChannelSchema = ChannelSchema;

// BACKEND API
// ===========

export const SimulatorChannelCreateReqSchema= ChannelCreateReqSchema.and(
	z.object({
		type: z.literal(SIMULATOR_TYPE),
	})
);

export const SimulatorChannelUpdateReqSchema= ChannelUpdateReqSchema.and(
	z.object({
		type: z.literal(SIMULATOR_TYPE),
	})
);

export const SimulatorChannelResSchema= ChannelResSchema.and(
	z.object({
		type: z.literal(SIMULATOR_TYPE),
	})
);
