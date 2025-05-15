import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	ConfigLanguageEditActionPayloadSchema,
	ConfigLanguageOnEventActionPayloadSchema,
	ConfigLanguageResSchema,
	ConfigLanguageSchema,
	ConfigLanguageSetActionPayloadSchema,
	ConfigLanguageStateSemaphoreSchema,
	ConfigLanguageUpdateReqSchema,
} from './config-language.store.schemas';

// STORE STATE
// ===========

export type IConfigLanguage = z.infer<typeof ConfigLanguageSchema>;

export type IConfigLanguageStateSemaphore = z.infer<typeof ConfigLanguageStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IConfigLanguageOnEventActionPayload = z.infer<typeof ConfigLanguageOnEventActionPayloadSchema>;

export type IConfigLanguageSetActionPayload = z.infer<typeof ConfigLanguageSetActionPayloadSchema>;

export type IConfigLanguageEditActionPayload = z.infer<typeof ConfigLanguageEditActionPayloadSchema>;

// STORE
// =====

export interface IConfigLanguageStoreState {
	data: Ref<IConfigLanguage | null>;
	semaphore: Ref<IConfigLanguageStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IConfigLanguageStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: () => boolean;
	// Actions
	onEvent: (payload: IConfigLanguageOnEventActionPayload) => IConfigLanguage;
	set: (payload: IConfigLanguageSetActionPayload) => IConfigLanguage;
	get: () => Promise<IConfigLanguage>;
	edit: (payload: IConfigLanguageEditActionPayload) => Promise<IConfigLanguage>;
}

export type ConfigLanguageStoreSetup = IConfigLanguageStoreState & IConfigLanguageStoreActions;

// BACKEND API
// ===========

export type IConfigLanguageUpdateReq = z.infer<typeof ConfigLanguageUpdateReqSchema>;

export type IConfigLanguageRes = z.infer<typeof ConfigLanguageResSchema>;

// STORE
export type ConfigLanguageStore = Store<string, IConfigLanguageStoreState, object, IConfigLanguageStoreActions>;
