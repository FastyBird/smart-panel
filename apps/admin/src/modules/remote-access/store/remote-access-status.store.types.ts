import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	RemoteAccessAdvisorySchema,
	RemoteAccessEndpointSchema,
	RemoteAccessProviderCapabilitiesSchema,
	RemoteAccessProviderSchema,
	RemoteAccessProviderStatusEventSchema,
	RemoteAccessStatusOnEventActionPayloadSchema,
	RemoteAccessStatusResSchema,
	RemoteAccessStatusSchema,
	RemoteAccessStatusSetActionPayloadSchema,
	RemoteAccessStatusStateSemaphoreSchema,
	RemoteAccessUrlsChangedEventSchema,
	RemoteAccessUrlsSchema,
} from './remote-access-status.store.schemas';

// STORE STATE
// ===========

export type IRemoteAccessEndpoint = z.infer<typeof RemoteAccessEndpointSchema>;

export type IRemoteAccessAdvisory = z.infer<typeof RemoteAccessAdvisorySchema>;

export type IRemoteAccessProviderCapabilities = z.infer<typeof RemoteAccessProviderCapabilitiesSchema>;

export type IRemoteAccessProvider = z.infer<typeof RemoteAccessProviderSchema>;

export type IRemoteAccessUrls = z.infer<typeof RemoteAccessUrlsSchema>;

export type IRemoteAccessStatus = z.infer<typeof RemoteAccessStatusSchema>;

export type IRemoteAccessStatusStateSemaphore = z.infer<typeof RemoteAccessStatusStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IRemoteAccessStatusOnEventActionPayload = z.infer<typeof RemoteAccessStatusOnEventActionPayloadSchema>;

export type IRemoteAccessStatusSetActionPayload = z.infer<typeof RemoteAccessStatusSetActionPayloadSchema>;

export type IRemoteAccessProviderStatusEvent = z.infer<typeof RemoteAccessProviderStatusEventSchema>;

export type IRemoteAccessUrlsChangedEvent = z.infer<typeof RemoteAccessUrlsChangedEventSchema>;

// STORE
// =====

export interface IRemoteAccessStatusStoreState {
	data: Ref<IRemoteAccessStatus | null>;
	semaphore: Ref<IRemoteAccessStatusStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IRemoteAccessStatusStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: () => boolean;
	// Actions
	onEvent: (payload: IRemoteAccessStatusOnEventActionPayload) => IRemoteAccessStatus | null;
	set: (payload: IRemoteAccessStatusSetActionPayload) => IRemoteAccessStatus;
	get: () => Promise<IRemoteAccessStatus>;
	isLoaded: () => boolean;
	refresh: () => Promise<unknown>;
}

export type RemoteAccessStatusStoreSetup = IRemoteAccessStatusStoreState & IRemoteAccessStatusStoreActions;

// BACKEND API
// ===========

export type IRemoteAccessStatusRes = z.infer<typeof RemoteAccessStatusResSchema>;

// STORE
export type RemoteAccessStatusStore = Store<string, IRemoteAccessStatusStoreState, object, IRemoteAccessStatusStoreActions>;
