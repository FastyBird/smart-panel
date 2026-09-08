import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	CloudflareTunnelInstallResultSchema,
	CloudflareTunnelPrivilegedSetupSchema,
	CloudflareTunnelRequirementRemedySchema,
	CloudflareTunnelRequirementSchema,
	CloudflareTunnelSetupJobSchema,
	CloudflareTunnelSetupProgressSchema,
	CloudflareTunnelStatusOnEventActionPayloadSchema,
	CloudflareTunnelStatusSchema,
	CloudflareTunnelStatusStateSemaphoreSchema,
} from './cloudflare-tunnel-status.store.schemas';

// STORE STATE
// ===========

export type ICloudflareTunnelRequirementRemedy = z.infer<typeof CloudflareTunnelRequirementRemedySchema>;

export type ICloudflareTunnelRequirement = z.infer<typeof CloudflareTunnelRequirementSchema>;

export type ICloudflareTunnelSetupJob = z.infer<typeof CloudflareTunnelSetupJobSchema>;

export type ICloudflareTunnelPrivilegedSetup = z.infer<typeof CloudflareTunnelPrivilegedSetupSchema>;

export type ICloudflareTunnelStatus = z.infer<typeof CloudflareTunnelStatusSchema>;

export type ICloudflareTunnelInstallResult = z.infer<typeof CloudflareTunnelInstallResultSchema>;

export type ICloudflareTunnelSetupProgress = z.infer<typeof CloudflareTunnelSetupProgressSchema>;

export type ICloudflareTunnelStatusStateSemaphore = z.infer<typeof CloudflareTunnelStatusStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type ICloudflareTunnelStatusOnEventActionPayload = z.infer<typeof CloudflareTunnelStatusOnEventActionPayloadSchema>;

// STORE
// =====

export interface ICloudflareTunnelStatusStoreState {
	data: Ref<ICloudflareTunnelStatus | null>;
	setupProgress: Ref<ICloudflareTunnelSetupProgress | null>;
	semaphore: Ref<ICloudflareTunnelStatusStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface ICloudflareTunnelStatusStoreActions {
	firstLoadFinished: () => boolean;
	isLoaded: () => boolean;
	get: () => Promise<ICloudflareTunnelStatus>;
	install: () => Promise<ICloudflareTunnelInstallResult>;
	reset: () => Promise<ICloudflareTunnelStatus>;
	onEvent: (payload: ICloudflareTunnelStatusOnEventActionPayload) => void;
	refresh: () => Promise<unknown>;
}

export type CloudflareTunnelStatusStoreSetup = ICloudflareTunnelStatusStoreState & ICloudflareTunnelStatusStoreActions;

export type CloudflareTunnelStatusStore = Store<string, ICloudflareTunnelStatusStoreState, object, ICloudflareTunnelStatusStoreActions>;
