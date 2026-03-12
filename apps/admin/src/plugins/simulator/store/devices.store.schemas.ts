import { z } from 'zod';

import { DeviceCreateReqSchema, DeviceResSchema, DeviceSchema, DeviceUpdateReqSchema } from '../../../modules/devices';
import { SIMULATOR_TYPE } from '../simulator.constants';

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

export const SimulatorDeviceResSchema= DeviceResSchema.and(
	z.object({
		type: z.literal(SIMULATOR_TYPE),
	})
);
