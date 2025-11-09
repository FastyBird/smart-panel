import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	StatsOnEventActionPayloadSchema,
	StatsResSchema,
	StatsSchema,
	StatsSetActionPayloadSchema,
	StatsStateSemaphoreSchema,
} from './stats.store.schemas';

// STORE STATE
// ===========

export type IStats = z.infer<typeof StatsSchema>;

export type IStatsStateSemaphore = z.infer<typeof StatsStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IStatsOnEventActionPayload = z.infer<typeof StatsOnEventActionPayloadSchema>;

export type IStatsSetActionPayload = z.infer<typeof StatsSetActionPayloadSchema>;

// STORE
// =====

export interface IStatsStoreState {
	data: Ref<IStats | null>;
	semaphore: Ref<IStatsStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IStatsStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: () => boolean;
	// Actions
	onEvent: (payload: IStatsOnEventActionPayload) => IStats;
	set: (payload: IStatsSetActionPayload) => IStats;
	get: () => Promise<IStats>;
}

export type StatsStoreSetup = IStatsStoreState & IStatsStoreActions;

// BACKEND API
// ===========

export type IStatsRes = z.infer<typeof StatsResSchema>;

// STORE
export type StatsStore = Store<string, IStatsStoreState, object, IStatsStoreActions>;
