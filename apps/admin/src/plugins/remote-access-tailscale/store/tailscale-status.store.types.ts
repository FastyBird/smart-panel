import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	TailscaleInstallResultSchema,
	TailscaleLoginResultSchema,
	TailscaleRequirementSchema,
	TailscaleSetupProgressSchema,
	TailscaleStatusOnEventActionPayloadSchema,
	TailscaleStatusSchema,
	TailscaleStatusStateSemaphoreSchema,
} from './tailscale-status.store.schemas';

// STORE STATE
// ===========

export type ITailscaleRequirement = z.infer<typeof TailscaleRequirementSchema>;

export type ITailscaleStatus = z.infer<typeof TailscaleStatusSchema>;

export type ITailscaleLoginResult = z.infer<typeof TailscaleLoginResultSchema>;

export type ITailscaleInstallResult = z.infer<typeof TailscaleInstallResultSchema>;

export type ITailscaleSetupProgress = z.infer<typeof TailscaleSetupProgressSchema>;

export type ITailscaleStatusStateSemaphore = z.infer<typeof TailscaleStatusStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type ITailscaleStatusOnEventActionPayload = z.infer<typeof TailscaleStatusOnEventActionPayloadSchema>;

// STORE
// =====

export interface ITailscaleStatusStoreState {
	data: Ref<ITailscaleStatus | null>;
	setupProgress: Ref<ITailscaleSetupProgress | null>;
	semaphore: Ref<ITailscaleStatusStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface ITailscaleStatusStoreActions {
	firstLoadFinished: () => boolean;
	isLoaded: () => boolean;
	get: () => Promise<ITailscaleStatus>;
	install: () => Promise<ITailscaleInstallResult>;
	login: (authKey?: string) => Promise<ITailscaleLoginResult>;
	logout: () => Promise<ITailscaleStatus>;
	resetPreferences: () => Promise<ITailscaleStatus>;
	onEvent: (payload: ITailscaleStatusOnEventActionPayload) => void;
	refresh: () => Promise<unknown>;
}

export type TailscaleStatusStoreSetup = ITailscaleStatusStoreState & ITailscaleStatusStoreActions;

export type TailscaleStatusStore = Store<string, ITailscaleStatusStoreState, object, ITailscaleStatusStoreActions>;
