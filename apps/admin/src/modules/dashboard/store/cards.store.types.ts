import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	CardCreateReqSchema,
	CardResSchema,
	CardSchema,
	CardUpdateReqSchema,
	CardsAddActionPayloadSchema,
	CardsEditActionPayloadSchema,
	CardsFetchActionPayloadSchema,
	CardsGetActionPayloadSchema,
	CardsRemoveActionPayloadSchema,
	CardsSaveActionPayloadSchema,
	CardsSetActionPayloadSchema,
	CardsStateSemaphoreSchema,
	CardsUnsetActionPayloadSchema,
} from './cards.store.schemas';
import { type IPage } from './pages.store.types';

// STORE STATE
// ===========

export type ICard = z.infer<typeof CardSchema>;

export type ICardsStateSemaphore = z.infer<typeof CardsStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type ICardsSetActionPayload = z.infer<typeof CardsSetActionPayloadSchema>;

export type ICardsUnsetActionPayload = z.infer<typeof CardsUnsetActionPayloadSchema>;

export type ICardsGetActionPayload = z.infer<typeof CardsGetActionPayloadSchema>;

export type ICardsFetchActionPayload = z.infer<typeof CardsFetchActionPayloadSchema>;

export type ICardsAddActionPayload = z.infer<typeof CardsAddActionPayloadSchema>;

export type ICardsEditActionPayload = z.infer<typeof CardsEditActionPayloadSchema>;

export type ICardsSaveActionPayload = z.infer<typeof CardsSaveActionPayloadSchema>;

export type ICardsRemoveActionPayload = z.infer<typeof CardsRemoveActionPayloadSchema>;

// STORE
// =====

export interface ICardsStoreState {
	data: Ref<{ [key: ICard['id']]: ICard }>;
	semaphore: Ref<ICardsStateSemaphore>;
	firstLoad: Ref<IPage['id'][]>;
}

export interface ICardsStoreActions {
	// Getters
	firstLoadFinished: (pageId: IPage['id']) => boolean;
	getting: (id: ICard['id']) => boolean;
	fetching: (pageId: IPage['id']) => boolean;
	findById: (id: ICard['id']) => ICard | null;
	findForPage: (pageId: IPage['id']) => ICard[];
	findAll: () => ICard[];
	// Actions
	set: (payload: ICardsSetActionPayload) => ICard;
	unset: (payload: ICardsUnsetActionPayload) => void;
	get: (payload: ICardsGetActionPayload) => Promise<ICard>;
	fetch: (payload: ICardsFetchActionPayload) => Promise<ICard[]>;
	add: (payload: ICardsAddActionPayload) => Promise<ICard>;
	edit: (payload: ICardsEditActionPayload) => Promise<ICard>;
	save: (payload: ICardsSaveActionPayload) => Promise<ICard>;
	remove: (payload: ICardsRemoveActionPayload) => Promise<boolean>;
}

export type CardsStoreSetup = ICardsStoreState & ICardsStoreActions;

// BACKEND API
// ===========

export type ICardCreateReq = z.infer<typeof CardCreateReqSchema>;

export type ICardUpdateReq = z.infer<typeof CardUpdateReqSchema>;

export type ICardRes = z.infer<typeof CardResSchema>;

// STORE
export type CardsStore = Store<string, ICardsStoreState, object, ICardsStoreActions>;
