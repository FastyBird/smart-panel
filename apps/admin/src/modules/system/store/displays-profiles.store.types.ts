import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	DisplayProfileCreateReqSchema,
	DisplayProfileResSchema,
	DisplayProfileSchema,
	DisplayProfileUpdateReqSchema,
	DisplaysProfilesAddActionPayloadSchema,
	DisplaysProfilesEditActionPayloadSchema,
	DisplaysProfilesGetActionPayloadSchema,
	DisplaysProfilesOnEventActionPayloadSchema,
	DisplaysProfilesRemoveActionPayloadSchema,
	DisplaysProfilesSaveActionPayloadSchema,
	DisplaysProfilesSetActionPayloadSchema,
	DisplaysProfilesStateSemaphoreSchema,
	DisplaysProfilesUnsetActionPayloadSchema,
} from './displays-profiles.store.schemas';

// STORE STATE
// ===========

export type IDisplayProfile = z.infer<typeof DisplayProfileSchema>;

export type IDisplaysProfilesStateSemaphore = z.infer<typeof DisplaysProfilesStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IDisplaysProfilesOnEventActionPayload = z.infer<typeof DisplaysProfilesOnEventActionPayloadSchema>;

export type IDisplaysProfilesSetActionPayload = z.infer<typeof DisplaysProfilesSetActionPayloadSchema>;

export type IDisplaysProfilesUnsetActionPayload = z.infer<typeof DisplaysProfilesUnsetActionPayloadSchema>;

export type IDisplaysProfilesGetActionPayload = z.infer<typeof DisplaysProfilesGetActionPayloadSchema>;

export type IDisplaysProfilesAddActionPayload = z.infer<typeof DisplaysProfilesAddActionPayloadSchema>;

export type IDisplaysProfilesEditActionPayload = z.infer<typeof DisplaysProfilesEditActionPayloadSchema>;

export type IDisplaysProfilesSaveActionPayload = z.infer<typeof DisplaysProfilesSaveActionPayloadSchema>;

export type IDisplaysProfilesRemoveActionPayload = z.infer<typeof DisplaysProfilesRemoveActionPayloadSchema>;

// STORE
// =====

export interface IDisplaysProfilesStoreState {
	data: Ref<{ [key: IDisplayProfile['id']]: IDisplayProfile }>;
	semaphore: Ref<IDisplaysProfilesStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IDisplaysProfilesStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: (id: IDisplayProfile['id']) => boolean;
	fetching: () => boolean;
	findById: (id: IDisplayProfile['id']) => IDisplayProfile | null;
	findAll: () => IDisplayProfile[];
	// Actions
	onEvent: (payload: IDisplaysProfilesOnEventActionPayload) => IDisplayProfile;
	set: (payload: IDisplaysProfilesSetActionPayload) => IDisplayProfile;
	unset: (payload: IDisplaysProfilesUnsetActionPayload) => void;
	get: (payload: IDisplaysProfilesGetActionPayload) => Promise<IDisplayProfile>;
	fetch: () => Promise<IDisplayProfile[]>;
	add: (payload: IDisplaysProfilesAddActionPayload) => Promise<IDisplayProfile>;
	edit: (payload: IDisplaysProfilesEditActionPayload) => Promise<IDisplayProfile>;
	save: (payload: IDisplaysProfilesSaveActionPayload) => Promise<IDisplayProfile>;
	remove: (payload: IDisplaysProfilesRemoveActionPayload) => Promise<boolean>;
}

export type DisplaysProfilesStoreSetup = IDisplaysProfilesStoreState & IDisplaysProfilesStoreActions;

// BACKEND API
// ===========

export type IDisplayProfileCreateReq = z.infer<typeof DisplayProfileCreateReqSchema>;

export type IDisplayProfileUpdateReq = z.infer<typeof DisplayProfileUpdateReqSchema>;

export type IDisplayProfileRes = z.infer<typeof DisplayProfileResSchema>;

// STORE
export type DisplaysProfilesStore = Store<string, IDisplaysProfilesStoreState, object, IDisplaysProfilesStoreActions>;
