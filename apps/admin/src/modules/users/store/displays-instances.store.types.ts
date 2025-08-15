import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	DisplayInstanceCreateReqSchema,
	DisplayInstanceResSchema,
	DisplayInstanceSchema,
	DisplayInstanceUpdateReqSchema,
	DisplaysInstancesAddActionPayloadSchema,
	DisplaysInstancesEditActionPayloadSchema,
	DisplaysInstancesGetActionPayloadSchema,
	DisplaysInstancesOnEventActionPayloadSchema,
	DisplaysInstancesRemoveActionPayloadSchema,
	DisplaysInstancesSaveActionPayloadSchema,
	DisplaysInstancesSetActionPayloadSchema,
	DisplaysInstancesStateSemaphoreSchema,
	DisplaysInstancesUnsetActionPayloadSchema,
} from './displays-instances.store.schemas';

// STORE STATE
// ===========

export type IDisplayInstance = z.infer<typeof DisplayInstanceSchema>;

export type IDisplaysInstancesStateSemaphore = z.infer<typeof DisplaysInstancesStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IDisplaysInstancesOnEventActionPayload = z.infer<typeof DisplaysInstancesOnEventActionPayloadSchema>;

export type IDisplaysInstancesSetActionPayload = z.infer<typeof DisplaysInstancesSetActionPayloadSchema>;

export type IDisplaysInstancesUnsetActionPayload = z.infer<typeof DisplaysInstancesUnsetActionPayloadSchema>;

export type IDisplaysInstancesGetActionPayload = z.infer<typeof DisplaysInstancesGetActionPayloadSchema>;

export type IDisplaysInstancesAddActionPayload = z.infer<typeof DisplaysInstancesAddActionPayloadSchema>;

export type IDisplaysInstancesEditActionPayload = z.infer<typeof DisplaysInstancesEditActionPayloadSchema>;

export type IDisplaysInstancesSaveActionPayload = z.infer<typeof DisplaysInstancesSaveActionPayloadSchema>;

export type IDisplaysInstancesRemoveActionPayload = z.infer<typeof DisplaysInstancesRemoveActionPayloadSchema>;

// STORE
// =====

export interface IDisplaysInstancesStoreState {
	data: Ref<{ [key: IDisplayInstance['id']]: IDisplayInstance }>;
	semaphore: Ref<IDisplaysInstancesStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IDisplaysInstancesStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: (id: IDisplayInstance['id']) => boolean;
	fetching: () => boolean;
	findById: (id: IDisplayInstance['id']) => IDisplayInstance | null;
	findAll: () => IDisplayInstance[];
	// Actions
	onEvent: (payload: IDisplaysInstancesOnEventActionPayload) => IDisplayInstance;
	set: (payload: IDisplaysInstancesSetActionPayload) => IDisplayInstance;
	unset: (payload: IDisplaysInstancesUnsetActionPayload) => void;
	get: (payload: IDisplaysInstancesGetActionPayload) => Promise<IDisplayInstance>;
	fetch: () => Promise<IDisplayInstance[]>;
	add: (payload: IDisplaysInstancesAddActionPayload) => Promise<IDisplayInstance>;
	edit: (payload: IDisplaysInstancesEditActionPayload) => Promise<IDisplayInstance>;
	save: (payload: IDisplaysInstancesSaveActionPayload) => Promise<IDisplayInstance>;
	remove: (payload: IDisplaysInstancesRemoveActionPayload) => Promise<boolean>;
}

export type DisplaysInstancesStoreSetup = IDisplaysInstancesStoreState & IDisplaysInstancesStoreActions;

// BACKEND API
// ===========

export type IDisplayInstanceCreateReq = z.infer<typeof DisplayInstanceCreateReqSchema>;

export type IDisplayInstanceUpdateReq = z.infer<typeof DisplayInstanceUpdateReqSchema>;

export type IDisplayInstanceRes = z.infer<typeof DisplayInstanceResSchema>;

// STORE
export type DisplaysInstancesStore = Store<string, IDisplaysInstancesStoreState, object, IDisplaysInstancesStoreActions>;
