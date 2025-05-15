import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	ConfigAudioEditActionPayloadSchema,
	ConfigAudioOnEventActionPayloadSchema,
	ConfigAudioResSchema,
	ConfigAudioSchema,
	ConfigAudioSetActionPayloadSchema,
	ConfigAudioStateSemaphoreSchema,
	ConfigAudioUpdateReqSchema,
} from './config-audio.store.schemas';

// STORE STATE
// ===========

export type IConfigAudio = z.infer<typeof ConfigAudioSchema>;

export type IConfigAudioStateSemaphore = z.infer<typeof ConfigAudioStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IConfigAudioOnEventActionPayload = z.infer<typeof ConfigAudioOnEventActionPayloadSchema>;

export type IConfigAudioSetActionPayload = z.infer<typeof ConfigAudioSetActionPayloadSchema>;

export type IConfigAudioEditActionPayload = z.infer<typeof ConfigAudioEditActionPayloadSchema>;

// STORE
// =====

export interface IConfigAudioStoreState {
	data: Ref<IConfigAudio | null>;
	semaphore: Ref<IConfigAudioStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IConfigAudioStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: () => boolean;
	// Actions
	onEvent: (payload: IConfigAudioOnEventActionPayload) => IConfigAudio;
	set: (payload: IConfigAudioSetActionPayload) => IConfigAudio;
	get: () => Promise<IConfigAudio>;
	edit: (payload: IConfigAudioEditActionPayload) => Promise<IConfigAudio>;
}

export type ConfigAudioStoreSetup = IConfigAudioStoreState & IConfigAudioStoreActions;

// BACKEND API
// ===========

export type IConfigAudioUpdateReq = z.infer<typeof ConfigAudioUpdateReqSchema>;

export type IConfigAudioRes = z.infer<typeof ConfigAudioResSchema>;

// STORE
export type ConfigAudioStore = Store<string, IConfigAudioStoreState, object, IConfigAudioStoreActions>;
