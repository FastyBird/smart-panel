import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	ConfigAppOnEventActionPayloadSchema,
	ConfigAppResSchema,
	ConfigAppSchema,
	ConfigAppSetActionPayloadSchema,
	ConfigAppStateSemaphoreSchema,
} from './config-app.store.schemas';

// STORE STATE
// ===========

export type IConfigApp = z.infer<typeof ConfigAppSchema>;

export type IConfigAppStateSemaphore = z.infer<typeof ConfigAppStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IConfigAppOnEventActionPayload = z.infer<typeof ConfigAppOnEventActionPayloadSchema>;

export type IConfigAppSetActionPayload = z.infer<typeof ConfigAppSetActionPayloadSchema>;

// STORE
// =====

export interface IConfigAppStoreState {
	data: Ref<IConfigApp | null>;
	semaphore: Ref<IConfigAppStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IConfigAppStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: () => boolean;
	// Actions
	onEvent: (payload: IConfigAppOnEventActionPayload) => IConfigApp;
	set: (payload: IConfigAppSetActionPayload) => IConfigApp;
	get: () => Promise<IConfigApp>;
}

export type ConfigAppStoreSetup = IConfigAppStoreState & IConfigAppStoreActions;

// BACKEND API
// ===========

export type IConfigAppRes = z.infer<typeof ConfigAppResSchema>;

// STORE
export type ConfigAppStore = Store<string, IConfigAppStoreState, object, IConfigAppStoreActions>;
