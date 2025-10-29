import { type Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import { ExtensionResSchema, ExtensionSchema, ExtensionsGetActionPayloadSchema, ExtensionsStateSemaphoreSchema } from './extensions.store.schemas';

// STORE STATE
// ===========

export type IExtension = z.infer<typeof ExtensionSchema>;

export type IExtensionsStateSemaphore = z.infer<typeof ExtensionsStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IExtensionsGetActionPayload = z.infer<typeof ExtensionsGetActionPayloadSchema>;

// STORE
// =====

export interface IExtensionsStoreState {
	data: Ref<{ [key: IExtension['name']]: { admin?: IExtension; backend?: IExtension } }>;
	semaphore: Ref<IExtensionsStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IExtensionsStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: (id: IExtension['name']) => boolean;
	fetching: () => boolean;
	findByName: (id: IExtension['name']) => { admin?: IExtension; backend?: IExtension } | null;
	findAll: () => { admin?: IExtension; backend?: IExtension }[];
	// Actions
	get: (payload: IExtensionsGetActionPayload) => Promise<{ admin?: IExtension; backend?: IExtension }>;
	fetch: () => Promise<{ admin?: IExtension; backend?: IExtension }[]>;
}

export type ExtensionsStoreSetup = IExtensionsStoreState & IExtensionsStoreActions;

// BACKEND API
// ===========

export type IExtensionRes = z.infer<typeof ExtensionResSchema>;

// STORE
export type ExtensionsStore = Store<string, IExtensionsStoreState, object, IExtensionsStoreActions>;
