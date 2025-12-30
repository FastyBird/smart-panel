import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	HomeAssistantDiscoveredHelperResSchema,
	HomeAssistantDiscoveredHelperSchema,
	HomeAssistantDiscoveredHelpersGetActionPayloadSchema,
	HomeAssistantDiscoveredHelpersSetActionPayloadSchema,
	HomeAssistantDiscoveredHelpersStateSemaphoreSchema,
	HomeAssistantDiscoveredHelpersUnsetActionPayloadSchema,
} from './home-assistant-discovered-helpers.store.schemas';

// STORE STATE
// ===========

export type IHomeAssistantDiscoveredHelper = z.infer<typeof HomeAssistantDiscoveredHelperSchema>;

export type IHomeAssistantDiscoveredHelpersStateSemaphore = z.infer<typeof HomeAssistantDiscoveredHelpersStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IHomeAssistantDiscoveredHelpersSetActionPayload = z.infer<typeof HomeAssistantDiscoveredHelpersSetActionPayloadSchema>;

export type IHomeAssistantDiscoveredHelpersUnsetActionPayload = z.infer<typeof HomeAssistantDiscoveredHelpersUnsetActionPayloadSchema>;

export type IHomeAssistantDiscoveredHelpersGetActionPayload = z.infer<typeof HomeAssistantDiscoveredHelpersGetActionPayloadSchema>;

// STORE
// =====

export interface IHomeAssistantDiscoveredHelpersStoreState {
	data: Ref<{ [key: IHomeAssistantDiscoveredHelper['entityId']]: IHomeAssistantDiscoveredHelper }>;
	semaphore: Ref<IHomeAssistantDiscoveredHelpersStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IHomeAssistantDiscoveredHelpersStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: (entityId: IHomeAssistantDiscoveredHelper['entityId']) => boolean;
	fetching: () => boolean;
	findByEntityId: (entityId: IHomeAssistantDiscoveredHelper['entityId']) => IHomeAssistantDiscoveredHelper | null;
	findAll: () => IHomeAssistantDiscoveredHelper[];
	// Actions
	set: (payload: IHomeAssistantDiscoveredHelpersSetActionPayload) => IHomeAssistantDiscoveredHelper;
	unset: (payload: IHomeAssistantDiscoveredHelpersUnsetActionPayload) => void;
	get: (payload: IHomeAssistantDiscoveredHelpersGetActionPayload) => Promise<IHomeAssistantDiscoveredHelper>;
	fetch: () => Promise<IHomeAssistantDiscoveredHelper[]>;
}

export type HomeAssistantDiscoveredHelpersStoreSetup = IHomeAssistantDiscoveredHelpersStoreState & IHomeAssistantDiscoveredHelpersStoreActions;

// BACKEND API
// ===========

export type IHomeAssistantDiscoveredHelperRes = z.infer<typeof HomeAssistantDiscoveredHelperResSchema>;

// STORE
export type HomeAssistantDiscoveredHelpersStore = Store<
	string,
	IHomeAssistantDiscoveredHelpersStoreState,
	object,
	IHomeAssistantDiscoveredHelpersStoreActions
>;
