import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	ConfigSystemEditActionPayloadSchema,
	ConfigSystemOnEventActionPayloadSchema,
	ConfigSystemResSchema,
	ConfigSystemSchema,
	ConfigSystemSetActionPayloadSchema,
	ConfigSystemStateSemaphoreSchema,
	ConfigSystemUpdateReqSchema,
} from './config-system.store.schemas';

// STORE STATE
// ===========

export type IConfigSystem = z.infer<typeof ConfigSystemSchema>;

export type IConfigSystemStateSemaphore = z.infer<typeof ConfigSystemStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IConfigSystemOnEventActionPayload = z.infer<typeof ConfigSystemOnEventActionPayloadSchema>;

export type IConfigSystemSetActionPayload = z.infer<typeof ConfigSystemSetActionPayloadSchema>;

export type IConfigSystemEditActionPayload = z.infer<typeof ConfigSystemEditActionPayloadSchema>;

// STORE
// =====

export interface IConfigSystemStoreState {
	data: Ref<IConfigSystem | null>;
	semaphore: Ref<IConfigSystemStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IConfigSystemStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: () => boolean;
	// Actions
	onEvent: (payload: IConfigSystemOnEventActionPayload) => IConfigSystem;
	set: (payload: IConfigSystemSetActionPayload) => IConfigSystem;
	get: () => Promise<IConfigSystem>;
	edit: (payload: IConfigSystemEditActionPayload) => Promise<IConfigSystem>;
}

export type ConfigSystemStoreSetup = IConfigSystemStoreState & IConfigSystemStoreActions;

// BACKEND API
// ===========

export type IConfigSystemUpdateReq = z.infer<typeof ConfigSystemUpdateReqSchema>;

export type IConfigSystemRes = z.infer<typeof ConfigSystemResSchema>;

// STORE
export type ConfigSystemStore = Store<string, IConfigSystemStoreState, object, IConfigSystemStoreActions>;
