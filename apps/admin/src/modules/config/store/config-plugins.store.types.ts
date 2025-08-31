import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	ConfigPluginResSchema,
	ConfigPluginSchema,
	ConfigPluginUpdateReqSchema,
	ConfigPluginsEditActionPayloadSchema,
	ConfigPluginsGetActionPayloadSchema,
	ConfigPluginsOnEventActionPayloadSchema,
	ConfigPluginsSetActionPayloadSchema,
	ConfigPluginsStateSemaphoreSchema,
} from './config-plugins.store.schemas';

// STORE STATE
// ===========

export type IConfigPlugin = z.infer<typeof ConfigPluginSchema>;

export type IConfigPluginsStateSemaphore = z.infer<typeof ConfigPluginsStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IConfigPluginsOnEventActionPayload = z.infer<typeof ConfigPluginsOnEventActionPayloadSchema>;

export type IConfigPluginsSetActionPayload = z.infer<typeof ConfigPluginsSetActionPayloadSchema>;

export type IConfigPluginsGetActionPayload = z.infer<typeof ConfigPluginsGetActionPayloadSchema>;

export type IConfigPluginsEditActionPayload = z.infer<typeof ConfigPluginsEditActionPayloadSchema>;

// STORE
// =====

export interface IConfigPluginsStoreState {
	data: Ref<{ [key: string]: IConfigPlugin }>;
	semaphore: Ref<IConfigPluginsStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IConfigPluginsStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	findByType: (id: IConfigPlugin['type']) => IConfigPlugin | null;
	findAll: () => IConfigPlugin[];
	getting: (plugin: IConfigPlugin['type']) => boolean;
	fetching: () => boolean;
	updating: (plugin: IConfigPlugin['type']) => boolean;
	// Actions
	onEvent: (payload: IConfigPluginsOnEventActionPayload) => IConfigPlugin;
	set: (payload: IConfigPluginsSetActionPayload) => IConfigPlugin;
	get: (payload: IConfigPluginsGetActionPayload) => Promise<IConfigPlugin>;
	fetch: () => Promise<IConfigPlugin[]>;
	edit: (payload: IConfigPluginsEditActionPayload) => Promise<IConfigPlugin>;
}

export type ConfigPluginsStoreSetup = IConfigPluginsStoreState & IConfigPluginsStoreActions;

// BACKEND API
// ===========

export type IConfigPluginUpdateReq = z.infer<typeof ConfigPluginUpdateReqSchema>;

export type IConfigPluginRes = z.infer<typeof ConfigPluginResSchema>;

// STORE
export type ConfigPluginStore = Store<string, IConfigPluginsStoreState, object, IConfigPluginsStoreActions>;
