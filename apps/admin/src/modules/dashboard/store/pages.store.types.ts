import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	PageCreateReqSchema,
	PageResSchema,
	PageSchema,
	PageUpdateReqSchema,
	PagesAddActionPayloadSchema,
	PagesEditActionPayloadSchema,
	PagesGetActionPayloadSchema,
	PagesOnSetActionPayloadSchema,
	PagesRemoveActionPayloadSchema,
	PagesSaveActionPayloadSchema,
	PagesSetActionPayloadSchema,
	PagesStateSemaphoreSchema,
	PagesUnsetActionPayloadSchema,
} from './pages.store.schemas';

// STORE STATE
// ===========

export type IPage = z.infer<typeof PageSchema>;

export type IPagesStateSemaphore = z.infer<typeof PagesStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IPagesOnEventActionPayload = z.infer<typeof PagesOnSetActionPayloadSchema>;

export type IPagesSetActionPayload = z.infer<typeof PagesSetActionPayloadSchema>;

export type IPagesUnsetActionPayload = z.infer<typeof PagesUnsetActionPayloadSchema>;

export type IPagesGetActionPayload = z.infer<typeof PagesGetActionPayloadSchema>;

export type IPagesAddActionPayload = z.infer<typeof PagesAddActionPayloadSchema>;

export type IPagesEditActionPayload = z.infer<typeof PagesEditActionPayloadSchema>;

export type IPagesSaveActionPayload = z.infer<typeof PagesSaveActionPayloadSchema>;

export type IPagesRemoveActionPayload = z.infer<typeof PagesRemoveActionPayloadSchema>;

// STORE
// =====

export interface IPagesStoreState {
	data: Ref<{ [key: IPage['id']]: IPage }>;
	semaphore: Ref<IPagesStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IPagesStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: (id: IPage['id']) => boolean;
	fetching: () => boolean;
	findById: (id: IPage['id']) => IPage | null;
	findAll: () => IPage[];
	// Actions
	onEvent: (payload: IPagesOnEventActionPayload) => IPage;
	set: (payload: IPagesSetActionPayload) => IPage;
	unset: (payload: IPagesUnsetActionPayload) => void;
	get: (payload: IPagesGetActionPayload) => Promise<IPage>;
	fetch: () => Promise<IPage[]>;
	add: (payload: IPagesAddActionPayload) => Promise<IPage>;
	edit: (payload: IPagesEditActionPayload) => Promise<IPage>;
	save: (payload: IPagesSaveActionPayload) => Promise<IPage>;
	remove: (payload: IPagesRemoveActionPayload) => Promise<boolean>;
}

export type PagesStoreSetup = IPagesStoreState & IPagesStoreActions;

// BACKEND API
// ===========

export type IPageCreateReq = z.infer<typeof PageCreateReqSchema>;

export type IPageUpdateReq = z.infer<typeof PageUpdateReqSchema>;

export type IPageRes = z.infer<typeof PageResSchema>;

// STORE
export type PagesStore = Store<string, IPagesStoreState, object, IPagesStoreActions>;
