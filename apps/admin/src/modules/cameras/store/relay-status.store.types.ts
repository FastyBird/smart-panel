import type { Ref } from 'vue';

import { z } from 'zod';

import { RelayStatusSchema } from './relay-status.store.schemas';

// STORE STATE
// ===========

export type IRelayStatus = z.infer<typeof RelayStatusSchema>;

// STORE
// =====

export interface IRelayStatusStoreState {
	status: Ref<IRelayStatus | null>;
}

export interface IRelayStatusStoreActions {
	get: () => Promise<IRelayStatus>;
	startPolling: () => () => void;
	isLoaded: () => boolean;
	refresh: () => Promise<unknown>;
}

export type RelayStatusStoreSetup = IRelayStatusStoreState & IRelayStatusStoreActions;
