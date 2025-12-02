import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	ConfigModuleResSchema,
	ConfigModuleSchema,
	ConfigModuleUpdateReqSchema,
	ConfigModulesEditActionPayloadSchema,
	ConfigModulesGetActionPayloadSchema,
	ConfigModulesOnEventActionPayloadSchema,
	ConfigModulesSetActionPayloadSchema,
	ConfigModulesStateSemaphoreSchema,
} from './config-modules.store.schemas';

// STORE STATE
// ===========

export type IConfigModule = z.infer<typeof ConfigModuleSchema>;

export type IConfigModulesStateSemaphore = z.infer<typeof ConfigModulesStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IConfigModulesOnEventActionPayload = z.infer<typeof ConfigModulesOnEventActionPayloadSchema>;

export type IConfigModulesSetActionPayload = z.infer<typeof ConfigModulesSetActionPayloadSchema>;

export type IConfigModulesGetActionPayload = z.infer<typeof ConfigModulesGetActionPayloadSchema>;

export type IConfigModulesEditActionPayload = z.infer<typeof ConfigModulesEditActionPayloadSchema>;

// STORE
// =====

export interface IConfigModulesStoreState {
	data: Ref<{ [key: string]: IConfigModule }>;
	semaphore: Ref<IConfigModulesStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IConfigModulesStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	findByType: (id: IConfigModule['type']) => IConfigModule | null;
	findAll: () => IConfigModule[];
	getting: (module: IConfigModule['type']) => boolean;
	fetching: () => boolean;
	updating: (module: IConfigModule['type']) => boolean;
	// Actions
	onEvent: (payload: IConfigModulesOnEventActionPayload) => IConfigModule;
	set: (payload: IConfigModulesSetActionPayload) => IConfigModule;
	get: (payload: IConfigModulesGetActionPayload) => Promise<IConfigModule>;
	fetch: () => Promise<IConfigModule[]>;
	edit: (payload: IConfigModulesEditActionPayload) => Promise<IConfigModule>;
}

export type ConfigModulesStoreSetup = IConfigModulesStoreState & IConfigModulesStoreActions;

// BACKEND API
// ===========

export type IConfigModuleUpdateReq = z.infer<typeof ConfigModuleUpdateReqSchema>;

export type IConfigModuleRes = z.infer<typeof ConfigModuleResSchema>;

// STORE
export type ConfigModuleStore = Store<string, IConfigModulesStoreState, object, IConfigModulesStoreActions>;

