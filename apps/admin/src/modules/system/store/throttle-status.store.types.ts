import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { type ZodType, z } from 'zod';

import { type components } from '../../../openapi';

type ApiThrottleStatus = components['schemas']['SystemThrottleStatus'];

// STORE STATE
// ===========

export const ThrottleStatusSchema = z.object({
	undervoltage: z.boolean(),
	frequencyCapping: z.boolean(),
	throttling: z.boolean(),
	softTempLimit: z.boolean(),
});
export type IThrottleStatus = z.infer<typeof ThrottleStatusSchema>;

export const ThrottleStatusStateSemaphoreSchema = z.object({
	getting: z.boolean(),
});
export type IThrottleStatusStateSemaphore = z.infer<typeof ThrottleStatusStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export const ThrottleStatusSetActionPayloadSchema = z.object({
	data: z.object({
		undervoltage: z.boolean(),
		frequencyCapping: z.boolean(),
		throttling: z.boolean(),
		softTempLimit: z.boolean(),
	}),
});
export type IThrottleStatusSetActionPayload = z.infer<typeof ThrottleStatusSetActionPayloadSchema>;

// STORE
// =====

export interface IThrottleStatusStoreState {
	data: Ref<IThrottleStatus | null>;
	semaphore: Ref<IThrottleStatusStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IThrottleStatusStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: () => boolean;
	// Actions
	set: (payload: IThrottleStatusSetActionPayload) => IThrottleStatus;
	get: () => Promise<IThrottleStatus>;
}

export type ThrottleStatusStoreSetup = IThrottleStatusStoreState & IThrottleStatusStoreActions;

// BACKEND API
// ===========

export const ThrottleStatusResSchema: ZodType<ApiThrottleStatus> = z.object({
	undervoltage: z.boolean(),
	frequency_capping: z.boolean(),
	throttling: z.boolean(),
	soft_temp_limit: z.boolean(),
});
export type IThrottleStatusRes = z.infer<typeof ThrottleStatusResSchema>;

// STORE
export type ThrottleStatusStore = Store<string, IThrottleStatusStoreState, object, IThrottleStatusStoreActions>;
