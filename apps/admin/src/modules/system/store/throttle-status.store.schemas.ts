import { type ZodType, z } from 'zod';

import type { SystemModuleThrottleStatusSchema } from '../../../openapi.constants';

type ApiThrottleStatus = SystemModuleThrottleStatusSchema;

// STORE STATE
// ===========

export const ThrottleStatusSchema = z.object({
	undervoltage: z.boolean(),
	frequencyCapping: z.boolean(),
	throttling: z.boolean(),
	softTempLimit: z.boolean(),
});

export const ThrottleStatusStateSemaphoreSchema = z.object({
	getting: z.boolean(),
});

// STORE ACTIONS
// =============

export const ThrottleStatusOnEventActionPayloadSchema = z.object({
	data: z.object({}),
});

export const ThrottleStatusSetActionPayloadSchema = z.object({
	data: z.object({
		undervoltage: z.boolean(),
		frequencyCapping: z.boolean(),
		throttling: z.boolean(),
		softTempLimit: z.boolean(),
	}),
});

// BACKEND API
// ===========

export const ThrottleStatusResSchema: ZodType<ApiThrottleStatus> = z.object({
	undervoltage: z.boolean(),
	frequency_capping: z.boolean(),
	throttling: z.boolean(),
	soft_temp_limit: z.boolean(),
});
