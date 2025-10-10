import type { Store } from 'pinia';

import { z } from 'zod';

import type { RemovableRef } from '@vueuse/core';

import {
	ListQueryDataSchema,
	ListQueryGetActionPayloadSchema,
	ListQueryPatchActionPayloadSchema,
	ListQueryResetActionPayloadSchema,
	ListQuerySetActionPayloadSchema,
	ListQueryStateSchema,
	PaginationEntrySchema,
	SortEntrySchema,
} from './list.query.store.schemas';

export type ISortEntry = z.infer<typeof SortEntrySchema>;

export type IPaginationEntry = z.infer<typeof PaginationEntrySchema>;

export type IListQueryData = z.infer<typeof ListQueryDataSchema>;

// STORE STATE
// ===========

export type IListQueryState = z.infer<typeof ListQueryStateSchema>;

// STORE ACTIONS
// =============

export type IListQueryGetActionPayload = z.infer<typeof ListQueryGetActionPayloadSchema>;

export type IListQuerySetActionPayload = z.infer<typeof ListQuerySetActionPayloadSchema>;

export type IListQueryPatchActionPayload = z.infer<typeof ListQueryPatchActionPayloadSchema>;

export type IListQueryResetActionPayload = z.infer<typeof ListQueryResetActionPayloadSchema>;

// STORE
// =====

export interface IListQueryStoreState {
	entries: RemovableRef<IListQueryState>;
}

export interface IListQueryStoreActions {
	// Actions
	get: <T extends IListQueryData>(payload: IListQueryGetActionPayload) => T | undefined;
	set: (payload: IListQuerySetActionPayload) => void;
	patch: (payload: IListQueryPatchActionPayload) => void;
	reset: (payload: IListQueryResetActionPayload) => void;
	clear: () => void;
}

export type ListQueryStoreSetup = IListQueryStoreState & IListQueryStoreActions;

// STORE
export type ListQueryStore = Store<string, IListQueryStoreState, object, IListQueryStoreActions>;
