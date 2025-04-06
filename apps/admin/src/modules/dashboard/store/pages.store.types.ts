import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	CardsPageCreateReqSchema,
	CardsPageResSchema,
	CardsPageSchema,
	CardsPageUpdateReqSchema,
	DeviceDetailPageCreateReqSchema,
	DeviceDetailPageResSchema,
	DeviceDetailPageSchema,
	DeviceDetailPageUpdateReqSchema,
	PageBaseSchema,
	PageCreateBaseReqSchema,
	PageResSchema,
	PageUpdateBaseReqSchema,
	PagesAddActionPayloadSchema,
	PagesEditActionPayloadSchema,
	PagesGetActionPayloadSchema,
	PagesRemoveActionPayloadSchema,
	PagesSaveActionPayloadSchema,
	PagesSetActionPayloadSchema,
	PagesStateSemaphoreSchema,
	PagesUnsetActionPayloadSchema,
	TilesPageCreateReqSchema,
	TilesPageResSchema,
	TilesPageSchema,
	TilesPageUpdateReqSchema,
} from './pages.store.schemas';

// STORE STATE
// ===========

export type IPageBase = z.infer<typeof PageBaseSchema>;

export type ICardsPage = z.infer<typeof CardsPageSchema>;

export type ITilesPage = z.infer<typeof TilesPageSchema>;

export type IDeviceDetailPage = z.infer<typeof DeviceDetailPageSchema>;

export type IPage = ICardsPage | ITilesPage | IDeviceDetailPage;

export type IPagesStateSemaphore = z.infer<typeof PagesStateSemaphoreSchema>;

// STORE ACTIONS
// =============

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
	data: Ref<{ [key: IPageBase['id']]: IPageBase }>;
	semaphore: Ref<IPagesStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IPagesStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: (id: IPageBase['id']) => boolean;
	fetching: () => boolean;
	findById: (id: IPageBase['id']) => IPageBase | null;
	findAll: () => IPageBase[];
	// Actions
	set: (payload: IPagesSetActionPayload) => IPageBase;
	unset: (payload: IPagesUnsetActionPayload) => void;
	get: (payload: IPagesGetActionPayload) => Promise<IPageBase>;
	fetch: () => Promise<IPageBase[]>;
	add: (payload: IPagesAddActionPayload) => Promise<IPageBase>;
	edit: (payload: IPagesEditActionPayload) => Promise<IPageBase>;
	save: (payload: IPagesSaveActionPayload) => Promise<IPageBase>;
	remove: (payload: IPagesRemoveActionPayload) => Promise<boolean>;
}

export type PagesStoreSetup = IPagesStoreState & IPagesStoreActions;

// BACKEND API
// ===========

export type IPageCreateBaseReq = z.infer<typeof PageCreateBaseReqSchema>;

export type ICardPageCreateReq = z.infer<typeof CardsPageCreateReqSchema>;

export type ITilePageCreateReq = z.infer<typeof TilesPageCreateReqSchema>;

export type IDeviceDetailPageCreateReq = z.infer<typeof DeviceDetailPageCreateReqSchema>;

export type IPageCreateReq = ICardPageCreateReq | ITilePageCreateReq | IDeviceDetailPageCreateReq;

export type IPageUpdateBaseReq = z.infer<typeof PageUpdateBaseReqSchema>;

export type ICardsPageUpdateReq = z.infer<typeof CardsPageUpdateReqSchema>;

export type ITilesPageUpdateReq = z.infer<typeof TilesPageUpdateReqSchema>;

export type IDeviceDetailPageUpdateReq = z.infer<typeof DeviceDetailPageUpdateReqSchema>;

export type IPageUpdateReq = ICardsPageUpdateReq | ITilesPageUpdateReq | IDeviceDetailPageUpdateReq;

export type IPageRes = z.infer<typeof PageResSchema>;

export type ICardsPageRes = z.infer<typeof CardsPageResSchema>;

export type ITilesPageRes = z.infer<typeof TilesPageResSchema>;

export type IDeviceDetailPageRes = z.infer<typeof DeviceDetailPageResSchema>;

// STORE
export type PagesStore = Store<string, IPagesStoreState, object, IPagesStoreActions>;

// MISC
export type IPagesEntitiesSchemas = {
	page: typeof PageBaseSchema;
	createPageReq: typeof PageCreateBaseReqSchema;
	updatePageReq: typeof PageUpdateBaseReqSchema;
};
