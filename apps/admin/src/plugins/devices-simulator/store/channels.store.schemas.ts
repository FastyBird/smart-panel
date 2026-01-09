import { type ZodType, z } from 'zod';

import { ChannelCreateReqSchema, ChannelResSchema, ChannelSchema, ChannelUpdateReqSchema } from '../../../modules/devices';
import { DEVICES_SIMULATOR_TYPE } from '../devices-simulator.constants';

export const SimulatorChannelSchema = ChannelSchema;

// BACKEND API
// ===========

export const SimulatorChannelCreateReqSchema: ZodType = ChannelCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_SIMULATOR_TYPE),
	})
);

export const SimulatorChannelUpdateReqSchema: ZodType = ChannelUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_SIMULATOR_TYPE),
	})
);

export const SimulatorChannelResSchema: ZodType = ChannelResSchema.and(
	z.object({
		type: z.literal(DEVICES_SIMULATOR_TYPE),
	})
);
