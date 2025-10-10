import { type Pinia, defineStore } from 'pinia';

import { useLocalStorage } from '@vueuse/core';

import type {
	IListQueryData,
	IListQueryGetActionPayload,
	IListQueryPatchActionPayload,
	IListQueryResetActionPayload,
	IListQuerySetActionPayload,
	IListQueryState,
	ListQueryStore,
	ListQueryStoreSetup,
} from './list.query.store.types';

const STORAGE_KEY = 'fb:listQuery:v1';

export const useListQuery = defineStore<'common-list-query', ListQueryStoreSetup>('common-list-query', (): ListQueryStoreSetup => {
	const entries = useLocalStorage<IListQueryState>(STORAGE_KEY, {});

	const get = <T extends IListQueryData>(payload: IListQueryGetActionPayload): T | undefined => {
		const entry = entries.value[payload.key];

		if (!entry) {
			return undefined;
		}

		if (entry.version !== payload.expectedVersion) {
			return undefined;
		}

		return entry.data as T;
	};

	const set = (payload: IListQuerySetActionPayload): void => {
		entries.value[payload.key] = { version: payload.version, updatedAt: Date.now(), data: payload.data };
	};

	const patch = (payload: IListQueryPatchActionPayload): void => {
		const current = entries.value[payload.key]?.data ?? {};

		set({ key: payload.key, data: { ...current, ...payload.data }, version: payload.version });
	};

	const reset = (payload: IListQueryResetActionPayload): void => {
		delete entries.value[payload.key];
	};

	const clear = (): void => {
		entries.value = {};
	};

	return {
		entries,
		get,
		set,
		patch,
		reset,
		clear,
	};
});

export const registerListQueryStore = (pinia: Pinia): ListQueryStore => {
	return useListQuery(pinia);
};
