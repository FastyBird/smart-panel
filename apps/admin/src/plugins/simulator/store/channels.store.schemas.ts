import { type ZodType, z } from 'zod';

import type { SimulatorPluginChannelSchema } from '../../../openapi.constants';

import { ChannelCreateReqSchema, ChannelResSchema, ChannelSchema, ChannelUpdateReqSchema } from '../../../modules/devices';
import { SIMULATOR_TYPE } from '../simulator.constants';

type ApiChannel = SimulatorPluginChannelSchema;

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

export const SimulatorChannelResSchema: ZodType<ApiChannel> = ChannelResSchema.and(
	z.object({
		type: z.literal(SIMULATOR_TYPE),
	})
);
