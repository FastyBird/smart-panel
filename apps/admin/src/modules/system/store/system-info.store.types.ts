import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	SystemInfoOnEventActionPayloadSchema,
	SystemInfoResSchema,
	SystemInfoSchema,
	SystemInfoSetActionPayloadSchema,
	SystemInfoStateSemaphoreSchema,
} from './system-info.store.schemas';

// STORE STATE
// ===========

export type ISystemInfo = z.infer<typeof SystemInfoSchema>;

export type ISystemInfoStateSemaphore = z.infer<typeof SystemInfoStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type ISystemInfoOnEventActionPayload = z.infer<typeof SystemInfoOnEventActionPayloadSchema>;

export type ISystemInfoSetActionPayload = z.infer<typeof SystemInfoSetActionPayloadSchema>;

// STORE
// =====

export interface ISystemInfoStoreState {
	data: Ref<ISystemInfo | null>;
	semaphore: Ref<ISystemInfoStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface ISystemInfoStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: () => boolean;
	// Actions
	onEvent: (payload: ISystemInfoOnEventActionPayload) => ISystemInfo;
	set: (payload: ISystemInfoSetActionPayload) => ISystemInfo;
	get: () => Promise<ISystemInfo>;
}

export type SystemInfoStoreSetup = ISystemInfoStoreState & ISystemInfoStoreActions;

// BACKEND API
// ===========

export type ISystemInfoRes = z.infer<typeof SystemInfoResSchema>;

// STORE
export type SystemInfoStore = Store<string, ISystemInfoStoreState, object, ISystemInfoStoreActions>;
