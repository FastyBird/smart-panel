import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	ThrottleStatusOnEventActionPayloadSchema,
	ThrottleStatusResSchema,
	ThrottleStatusSchema,
	ThrottleStatusSetActionPayloadSchema,
	ThrottleStatusStateSemaphoreSchema,
} from './throttle-status.store.schemas';

// STORE STATE
// ===========

export type IThrottleStatus = z.infer<typeof ThrottleStatusSchema>;

export type IThrottleStatusStateSemaphore = z.infer<typeof ThrottleStatusStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IThrottleStatusOnEventActionPayload = z.infer<typeof ThrottleStatusOnEventActionPayloadSchema>;

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
	onEvent: (payload: IThrottleStatusOnEventActionPayload) => IThrottleStatus;
	set: (payload: IThrottleStatusSetActionPayload) => IThrottleStatus;
	get: () => Promise<IThrottleStatus | null>;
}

export type ThrottleStatusStoreSetup = IThrottleStatusStoreState & IThrottleStatusStoreActions;

// BACKEND API
// ===========

export type IThrottleStatusRes = z.infer<typeof ThrottleStatusResSchema>;

// STORE
export type ThrottleStatusStore = Store<string, IThrottleStatusStoreState, object, IThrottleStatusStoreActions>;
