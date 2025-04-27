import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	ConfigPluginResSchema,
	ConfigPluginSchema,
	ConfigPluginUpdateReqSchema,
	ConfigPluginsEditActionPayloadSchema,
	ConfigPluginsGetActionPayloadSchema,
	ConfigPluginsSetActionPayloadSchema,
	ConfigPluginsStateSemaphoreSchema,
} from './config-plugins.store.schemas';

// STORE STATE
// ===========

export type IConfigPlugin = z.infer<typeof ConfigPluginSchema>;

export type IConfigPluginsStateSemaphore = z.infer<typeof ConfigPluginsStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IConfigPluginsSetActionPayload = z.infer<typeof ConfigPluginsSetActionPayloadSchema>;

export type IConfigPluginsGetActionPayload = z.infer<typeof ConfigPluginsGetActionPayloadSchema>;

export type IConfigPluginsEditActionPayload = z.infer<typeof ConfigPluginsEditActionPayloadSchema>;

// STORE
// =====

export interface IConfigPluginsStoreState {
	data: Ref<{ [key: string]: IConfigPlugin }>;
	semaphore: Ref<IConfigPluginsStateSemaphore>;
}

export interface IConfigPluginsStoreActions {
	// Getters
	getting: (plugin: IConfigPlugin['type']) => boolean;
	updating: (plugin: IConfigPlugin['type']) => boolean;
	// Actions
	set: (payload: IConfigPluginsSetActionPayload) => IConfigPlugin;
	get: (payload: IConfigPluginsGetActionPayload) => Promise<IConfigPlugin>;
	edit: (payload: IConfigPluginsEditActionPayload) => Promise<IConfigPlugin>;
}

export type ConfigPluginsStoreSetup = IConfigPluginsStoreState & IConfigPluginsStoreActions;

// BACKEND API
// ===========

export type IConfigPluginUpdateReq = z.infer<typeof ConfigPluginUpdateReqSchema>;

export type IConfigPluginRes = z.infer<typeof ConfigPluginResSchema>;

// STORE
export type ConfigPluginStore = Store<string, IConfigPluginsStoreState, object, IConfigPluginsStoreActions>;
