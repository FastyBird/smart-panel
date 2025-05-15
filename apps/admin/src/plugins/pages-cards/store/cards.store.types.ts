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
	CardsOnEventActionPayloadSchema,
	CardsRemoveActionPayloadSchema,
	CardsSaveActionPayloadSchema,
	CardsSetActionPayloadSchema,
	CardsStateSemaphoreSchema,
	CardsUnsetActionPayloadSchema,
} from './cards.store.schemas';
import type { ICardsPage } from './pages.store.types';

// STORE STATE
// ===========

export type ICard = z.infer<typeof CardSchema>;

export type ICardsStateSemaphore = z.infer<typeof CardsStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type ICardsOnEventActionPayload = z.infer<typeof CardsOnEventActionPayloadSchema>;

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
	firstLoad: Ref<ICardsPage['id'][]>;
}

export interface ICardsStoreActions {
	// Getters
	firstLoadFinished: (pageId: ICardsPage['id']) => boolean;
	getting: (id: ICard['id']) => boolean;
	fetching: (pageId: ICardsPage['id']) => boolean;
	findById: (id: ICard['id']) => ICard | null;
	findForPage: (pageId: ICardsPage['id']) => ICard[];
	findAll: () => ICard[];
	// Actions
	onEvent: (payload: ICardsOnEventActionPayload) => ICard;
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
