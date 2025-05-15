import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	ConfigDisplayEditActionPayloadSchema,
	ConfigDisplayOnEventActionPayloadSchema,
	ConfigDisplayResSchema,
	ConfigDisplaySchema,
	ConfigDisplaySetActionPayloadSchema,
	ConfigDisplayStateSemaphoreSchema,
	ConfigDisplayUpdateReqSchema,
} from './config-display.store.schemas';

// STORE STATE
// ===========

export type IConfigDisplay = z.infer<typeof ConfigDisplaySchema>;

export type IConfigDisplayStateSemaphore = z.infer<typeof ConfigDisplayStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IConfigDisplayOnEventActionPayload = z.infer<typeof ConfigDisplayOnEventActionPayloadSchema>;

export type IConfigDisplaySetActionPayload = z.infer<typeof ConfigDisplaySetActionPayloadSchema>;

export type IConfigDisplayEditActionPayload = z.infer<typeof ConfigDisplayEditActionPayloadSchema>;

// STORE
// =====

export interface IConfigDisplayStoreState {
	data: Ref<IConfigDisplay | null>;
	semaphore: Ref<IConfigDisplayStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IConfigDisplayStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: () => boolean;
	// Actions
	onEvent: (payload: IConfigDisplayOnEventActionPayload) => IConfigDisplay;
	set: (payload: IConfigDisplaySetActionPayload) => IConfigDisplay;
	get: () => Promise<IConfigDisplay>;
	edit: (payload: IConfigDisplayEditActionPayload) => Promise<IConfigDisplay>;
}

export type ConfigDisplayStoreSetup = IConfigDisplayStoreState & IConfigDisplayStoreActions;

// BACKEND API
// ===========

export type IConfigDisplayUpdateReq = z.infer<typeof ConfigDisplayUpdateReqSchema>;

export type IConfigDisplayRes = z.infer<typeof ConfigDisplayResSchema>;

// STORE
export type ConfigDisplayStore = Store<string, IConfigDisplayStoreState, object, IConfigDisplayStoreActions>;
