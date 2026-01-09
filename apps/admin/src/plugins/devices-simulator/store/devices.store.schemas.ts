import { type ZodType, z } from 'zod';

import { DeviceCreateReqSchema, DeviceResSchema, DeviceSchema, DeviceUpdateReqSchema } from '../../../modules/devices';
import { DEVICES_SIMULATOR_TYPE } from '../devices-simulator.constants';

export const SimulatorDeviceSchema = DeviceSchema;

// BACKEND API
// ===========

export const SimulatorDeviceCreateReqSchema: ZodType = DeviceCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_SIMULATOR_TYPE),
	})
);

export const SimulatorDeviceUpdateReqSchema: ZodType = DeviceUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_SIMULATOR_TYPE),
	})
);

export const SimulatorDeviceResSchema: ZodType = DeviceResSchema.and(
	z.object({
		type: z.literal(DEVICES_SIMULATOR_TYPE),
	})
);
