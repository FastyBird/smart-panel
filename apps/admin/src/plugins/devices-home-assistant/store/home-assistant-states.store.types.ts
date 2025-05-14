import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	HomeAssistantStateResSchema,
	HomeAssistantStateSchema,
	HomeAssistantStatesGetActionPayloadSchema,
	HomeAssistantStatesSetActionPayloadSchema,
	HomeAssistantStatesStateSemaphoreSchema,
	HomeAssistantStatesUnsetActionPayloadSchema,
} from './home-assistant-states.store.schemas';

// STORE STATE
// ===========

export type IHomeAssistantState = z.infer<typeof HomeAssistantStateSchema>;

export type IHomeAssistantStatesStateSemaphore = z.infer<typeof HomeAssistantStatesStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IHomeAssistantStatesSetActionPayload = z.infer<typeof HomeAssistantStatesSetActionPayloadSchema>;

export type IHomeAssistantStatesUnsetActionPayload = z.infer<typeof HomeAssistantStatesUnsetActionPayloadSchema>;

export type IHomeAssistantStatesGetActionPayload = z.infer<typeof HomeAssistantStatesGetActionPayloadSchema>;

// STORE
// =====

export interface IHomeAssistantStatesStoreState {
	data: Ref<{ [key: IHomeAssistantState['entityId']]: IHomeAssistantState }>;
	semaphore: Ref<IHomeAssistantStatesStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IHomeAssistantStatesStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: (entityId: IHomeAssistantState['entityId']) => boolean;
	fetching: () => boolean;
	findById: (entityId: IHomeAssistantState['entityId']) => IHomeAssistantState | null;
	findAll: () => IHomeAssistantState[];
	// Actions
	set: (payload: IHomeAssistantStatesSetActionPayload) => IHomeAssistantState;
	unset: (payload: IHomeAssistantStatesUnsetActionPayload) => void;
	get: (payload: IHomeAssistantStatesGetActionPayload) => Promise<IHomeAssistantState>;
	fetch: () => Promise<IHomeAssistantState[]>;
}

export type HomeAssistantStatesStoreSetup = IHomeAssistantStatesStoreState & IHomeAssistantStatesStoreActions;

// BACKEND API
// ===========

export type IHomeAssistantStateRes = z.infer<typeof HomeAssistantStateResSchema>;

// STORE
export type HomeAssistantStatesStore = Store<string, IHomeAssistantStatesStoreState, object, IHomeAssistantStatesStoreActions>;
