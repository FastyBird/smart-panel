import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	DisplayCreateReqSchema,
	DisplayResSchema,
	DisplaySchema,
	DisplayTokenResSchema,
	DisplayUpdateReqSchema,
	DisplaysAddActionPayloadSchema,
	DisplaysEditActionPayloadSchema,
	DisplaysGetActionPayloadSchema,
	DisplaysOnEventActionPayloadSchema,
	DisplaysRemoveActionPayloadSchema,
	DisplaysRevokeTokenActionPayloadSchema,
	DisplaysSaveActionPayloadSchema,
	DisplaysSetActionPayloadSchema,
	DisplaysStateSemaphoreSchema,
	DisplaysUnsetActionPayloadSchema,
} from './displays.store.schemas';

// STORE STATE
// ===========

export type IDisplay = z.infer<typeof DisplaySchema>;

export type IDisplaysStateSemaphore = z.infer<typeof DisplaysStateSemaphoreSchema>;

export type IDisplayToken = z.infer<typeof DisplayTokenResSchema>;

// STORE ACTIONS
// =============

export type IDisplaysOnEventActionPayload = z.infer<typeof DisplaysOnEventActionPayloadSchema>;

export type IDisplaysSetActionPayload = z.infer<typeof DisplaysSetActionPayloadSchema>;

export type IDisplaysUnsetActionPayload = z.infer<typeof DisplaysUnsetActionPayloadSchema>;

export type IDisplaysGetActionPayload = z.infer<typeof DisplaysGetActionPayloadSchema>;

export type IDisplaysAddActionPayload = z.infer<typeof DisplaysAddActionPayloadSchema>;

export type IDisplaysEditActionPayload = z.infer<typeof DisplaysEditActionPayloadSchema>;

export type IDisplaysSaveActionPayload = z.infer<typeof DisplaysSaveActionPayloadSchema>;

export type IDisplaysRemoveActionPayload = z.infer<typeof DisplaysRemoveActionPayloadSchema>;

export type IDisplaysRevokeTokenActionPayload = z.infer<typeof DisplaysRevokeTokenActionPayloadSchema>;

// STORE
// =====

export interface IDisplaysStoreState {
	data: Ref<{ [key: IDisplay['id']]: IDisplay }>;
	semaphore: Ref<IDisplaysStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IDisplaysStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: (id: IDisplay['id']) => boolean;
	fetching: () => boolean;
	findById: (id: IDisplay['id']) => IDisplay | null;
	findAll: () => IDisplay[];
	// Actions
	onEvent: (payload: IDisplaysOnEventActionPayload) => IDisplay;
	set: (payload: IDisplaysSetActionPayload) => IDisplay;
	unset: (payload: IDisplaysUnsetActionPayload) => void;
	get: (payload: IDisplaysGetActionPayload) => Promise<IDisplay>;
	fetch: () => Promise<IDisplay[]>;
	add: (payload: IDisplaysAddActionPayload) => Promise<IDisplay>;
	edit: (payload: IDisplaysEditActionPayload) => Promise<IDisplay>;
	save: (payload: IDisplaysSaveActionPayload) => Promise<IDisplay>;
	remove: (payload: IDisplaysRemoveActionPayload) => Promise<boolean>;
	getTokens: (payload: IDisplaysGetActionPayload) => Promise<IDisplayToken[]>;
	revokeToken: (payload: IDisplaysRevokeTokenActionPayload) => Promise<boolean>;
}

export type DisplaysStoreSetup = IDisplaysStoreState & IDisplaysStoreActions;

// BACKEND API
// ===========

export type IDisplayCreateReq = z.infer<typeof DisplayCreateReqSchema>;

export type IDisplayUpdateReq = z.infer<typeof DisplayUpdateReqSchema>;

export type IDisplayRes = z.infer<typeof DisplayResSchema>;

export type IDisplayTokenRes = z.infer<typeof DisplayTokenResSchema>;

// STORE
export type DisplaysStore = Store<string, IDisplaysStoreState, object, IDisplaysStoreActions>;
