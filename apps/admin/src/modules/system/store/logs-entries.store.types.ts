import { type Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	AddLogEntrySchema,
	LogEntryCreateReqSchema,
	LogEntryResSchema,
	LogEntrySchema,
	LogsEntriesAddActionPayloadSchema,
	LogsEntriesFetchActionPayloadSchema,
	LogsEntriesOnEventActionPayloadSchema,
	LogsEntriesSetActionPayloadSchema,
	LogsEntriesStateSemaphoreSchema,
	LogsEntriesUnsetActionPayloadSchema,
} from './logs-entries.store.schemas';

// STORE STATE
// ===========

export type ILogEntry = z.infer<typeof LogEntrySchema>;

export type IAddLogEntry = z.infer<typeof AddLogEntrySchema>;

export type ILogsEntriesStateSemaphore = z.infer<typeof LogsEntriesStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type ILogsEntriesOnEventActionPayload = z.infer<typeof LogsEntriesOnEventActionPayloadSchema>;

export type ILogsEntriesSetActionPayload = z.infer<typeof LogsEntriesSetActionPayloadSchema>;

export type ILogsEntriesUnsetActionPayload = z.infer<typeof LogsEntriesUnsetActionPayloadSchema>;

export type ILogsEntriesFetchActionPayload = z.infer<typeof LogsEntriesFetchActionPayloadSchema>;

export type ILogsEntriesAddActionPayload = z.infer<typeof LogsEntriesAddActionPayloadSchema>;

// STORE
// =====

export interface ILogsEntriesStoreState {
	data: Ref<{ [key: ILogEntry['id']]: ILogEntry }>;
	semaphore: Ref<ILogsEntriesStateSemaphore>;
	firstLoad: Ref<boolean>;
	nextCursor: Ref<string | undefined>;
	hasMore: Ref<boolean>;
}

export interface ILogsEntriesStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	fetching: () => boolean;
	findById: (id: ILogEntry['id']) => ILogEntry | null;
	findAll: () => ILogEntry[];
	// Actions
	onEvent: (payload: ILogsEntriesOnEventActionPayload) => ILogEntry;
	set: (payload: ILogsEntriesSetActionPayload) => ILogEntry;
	unset: (payload: ILogsEntriesUnsetActionPayload) => void;
	fetch: (payload?: ILogsEntriesFetchActionPayload) => Promise<ILogEntry[]>;
	add: (payload: ILogsEntriesAddActionPayload) => Promise<{ failed?: { entry: IAddLogEntry; reason: string }[] }>;
}

export type LogsEntriesStoreSetup = ILogsEntriesStoreState & ILogsEntriesStoreActions;

// BACKEND API
// ===========

export type ILogEntryCreateReq = z.infer<typeof LogEntryCreateReqSchema>;

export type ILogEntryRes = z.infer<typeof LogEntryResSchema>;

// STORE
export type LogsEntriesStore = Store<string, ILogsEntriesStoreState, object, ILogsEntriesStoreActions>;
