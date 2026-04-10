import { type ZodType, z } from 'zod';

import { DeviceCreateReqSchema, DeviceResSchema, DeviceSchema, DeviceUpdateReqSchema } from '../../../modules/devices';
import type { SimulatorPluginDeviceSchema } from '../../../openapi.constants';
import { SimulatorPluginBehaviorMode } from '../../../openapi.constants';
import { SIMULATOR_TYPE } from '../simulator.constants';

type ApiDevice = SimulatorPluginDeviceSchema;

export const SimulatorDeviceSchema = DeviceSchema;

// BACKEND API
// ===========

export const SimulatorDeviceCreateReqSchema= DeviceCreateReqSchema.and(
	z.object({
		type: z.literal(SIMULATOR_TYPE),
	})
);

export const SimulatorDeviceUpdateReqSchema= DeviceUpdateReqSchema.and(
	z.object({
		type: z.literal(SIMULATOR_TYPE),
	})
);

export const SimulatorDeviceResSchema: ZodType<ApiDevice> = DeviceResSchema.and(
	z.object({
		type: z.literal(SIMULATOR_TYPE),
		auto_simulate: z.boolean(),
		simulate_interval: z.number(),
		behavior_mode: z.nativeEnum(SimulatorPluginBehaviorMode),
	})
);
