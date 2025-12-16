import { type Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	DiscoveredExtensionResSchema,
	DiscoveredExtensionSchema,
	DiscoveredExtensionsGetActionPayloadSchema,
	DiscoveredExtensionsStateSemaphoreSchema,
} from './discovered-extensions.store.schemas';

// STORE STATE
// ===========

export type IDiscoveredExtension = z.infer<typeof DiscoveredExtensionSchema>;

export type IDiscoveredExtensionsStateSemaphore = z.infer<typeof DiscoveredExtensionsStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IDiscoveredExtensionsGetActionPayload = z.infer<typeof DiscoveredExtensionsGetActionPayloadSchema>;

// STORE
// =====

export interface IDiscoveredExtensionsStoreState {
	data: Ref<{ [key: IDiscoveredExtension['name']]: { admin?: IDiscoveredExtension; backend?: IDiscoveredExtension } }>;
	semaphore: Ref<IDiscoveredExtensionsStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IDiscoveredExtensionsStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: (name: IDiscoveredExtension['name']) => boolean;
	fetching: () => boolean;
	findByName: (name: IDiscoveredExtension['name']) => { admin?: IDiscoveredExtension; backend?: IDiscoveredExtension } | null;
	findAll: () => { admin?: IDiscoveredExtension; backend?: IDiscoveredExtension }[];
	// Actions
	get: (payload: IDiscoveredExtensionsGetActionPayload) => Promise<{ admin?: IDiscoveredExtension; backend?: IDiscoveredExtension }>;
	fetch: () => Promise<{ admin?: IDiscoveredExtension; backend?: IDiscoveredExtension }[]>;
}

export type DiscoveredExtensionsStoreSetup = IDiscoveredExtensionsStoreState & IDiscoveredExtensionsStoreActions;

// BACKEND API
// ===========

export type IDiscoveredExtensionRes = z.infer<typeof DiscoveredExtensionResSchema>;

// STORE
export type DiscoveredExtensionsStore = Store<string, IDiscoveredExtensionsStoreState, object, IDiscoveredExtensionsStoreActions>;
