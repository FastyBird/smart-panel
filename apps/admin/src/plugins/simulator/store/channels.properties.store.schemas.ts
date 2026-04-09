import { type ZodType, z } from 'zod';

import type { SimulatorPluginChannelPropertySchema } from '../../../openapi.constants';

import {
	ChannelPropertyCreateReqSchema,
	ChannelPropertyResSchema,
	ChannelPropertySchema,
	ChannelPropertyUpdateReqSchema,
} from '../../../modules/devices';
import { SIMULATOR_TYPE } from '../simulator.constants';

type ApiChannelProperty = SimulatorPluginChannelPropertySchema;

export const SimulatorChannelPropertySchema = ChannelPropertySchema;

// BACKEND API
// ===========

export const SimulatorChannelPropertyCreateReqSchema= ChannelPropertyCreateReqSchema.and(
	z.object({
		type: z.literal(SIMULATOR_TYPE),
	})
);

export const SimulatorChannelPropertyUpdateReqSchema= ChannelPropertyUpdateReqSchema.and(
	z.object({
		type: z.literal(SIMULATOR_TYPE),
	})
);

export const SimulatorChannelPropertyResSchema: ZodType<ApiChannelProperty> = ChannelPropertyResSchema.and(
	z.object({
		type: z.literal(SIMULATOR_TYPE),
	})
);
