/*
eslint-disable @typescript-eslint/no-explicit-any
*/
import { nextTick, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { listQueryStoreKey } from '../store/keys';

import { useListQuery } from './useListQuery';

const routeQuery = ref<Record<string, unknown>>({});

const replaceSpy = vi.fn((arg: { query: Record<string, unknown> }) => {
	routeQuery.value = { ...arg.query };

	return Promise.resolve();
});

vi.mock('vue-router', () => ({
	useRoute: () => ({
		get query() {
			return routeQuery.value;
		},
	}),
	useRouter: () => ({ replace: replaceSpy }),
}));

type Entry = { version: number; updatedAt: number; data: unknown };

const memoryEntries: Record<string, Entry | undefined> = {};

const fakeStore = {
	entries: new Proxy<Record<string, { updatedAt?: number }>>(
		{},
		{
			get: (_t, key: string) => (memoryEntries[key] ? { updatedAt: memoryEntries[key]!.updatedAt } : undefined),
		}
	),
	get<T>({ key, expectedVersion }: { key: string; expectedVersion: number }): T | undefined {
		const e = memoryEntries[key];
		if (!e || e.version !== expectedVersion) return undefined;
		return e.data as T;
	},
	set({ key, data, version }: { key: string; data: any; version: number }) {
		memoryEntries[key] = { version, updatedAt: Date.now(), data };
	},
	patch({ key, data, version }: { key: string; data: any; version: number }) {
		const prev = memoryEntries[key]?.data ?? {};
		memoryEntries[key] = { version, updatedAt: Date.now(), data: { ...prev, ...data } };
	},
};

vi.mock('../services/store', () => ({
	injectStoresManager: vi.fn(() => ({
		getStore: (key: symbol) => {
			if (key === listQueryStoreKey) {
				return fakeStore;
			}

			throw new Error('Unknown store key');
		},
	})),
}));

const FilterSchema = z.object({
	search: z.string().optional(),
	types: z.array(z.string()).default([]),
	enabled: z.enum(['all', 'enabled', 'disabled']).default('all'),
});

type Filters = z.output<typeof FilterSchema>;

const defaultFilters: Filters = { search: undefined, types: [], enabled: 'all' };
const defaultPagination: { page: number; size: number } = { page: 1, size: 20 };
const defaultSort: { by: string; dir: 'asc' | 'desc' | null }[] = [{ by: 'name', dir: 'asc' }];

const resetRouter = () => {
	routeQuery.value = {};
	replaceSpy.mockClear();
};

const resetStorage = () => {
	Object.keys(memoryEntries).forEach((k) => delete memoryEntries[k]);
};

describe('useListQuery (composable)', () => {
	beforeEach(() => {
		setActivePinia(createPinia());

		resetRouter();
		resetStorage();

		vi.useFakeTimers();
		vi.setSystemTime(new Date('2025-02-01T00:00:00.000Z'));
	});

	it('initializes from defaults when no URL and no storage', () => {
		const { filters, pagination, sort } = useListQuery({
			key: 'k1',
			filters: { schema: FilterSchema, defaults: defaultFilters },
			pagination: { defaults: defaultPagination },
			sort: { defaults: defaultSort },
			syncQuery: true,
			version: 1,
		});

		expect(filters.value).toEqual(defaultFilters);
		expect(pagination.value).toEqual(defaultPagination);
		expect(sort.value).toEqual(defaultSort);
	});

	it('reads from URL (filters arrays coerced; sort dir fallback to defaults)', () => {
		routeQuery.value = {
			search: 'abc',
			types: ['t1', 't2'],
			enabled: 'enabled',
			page: '3',
			size: '10',
			sort: 'name', // no dir -> fallback to defaults for "name"
		};

		const { filters, pagination, sort } = useListQuery({
			key: 'k2',
			filters: { schema: FilterSchema, defaults: defaultFilters },
			pagination: { defaults: defaultPagination },
			sort: { defaults: defaultSort },
			syncQuery: true,
			version: 1,
		});

		expect(filters.value).toEqual({ search: 'abc', types: ['t1', 't2'], enabled: 'enabled' });
		expect(pagination.value).toEqual({ page: 3, size: 10 });
		expect(sort.value).toEqual([{ by: 'name', dir: 'asc' }]);
	});

	it('filters → URL: writes only non-defaults and prunes unknowns', async () => {
		const debounceMs = 150;

		// seed URL with an unknown key to ensure pruning works
		routeQuery.value = { foo: 'bar' };

		const { filters } = useListQuery({
			key: 'k3',
			filters: { schema: FilterSchema, defaults: defaultFilters },
			pagination: { defaults: defaultPagination },
			sort: { defaults: defaultSort },
			syncQuery: true,
			version: 1,
			debounceMs,
			includeInQuery: () => true,
		});

		// set non-defaults
		filters.value.search = 'x';

		await vi.advanceTimersByTimeAsync(debounceMs);
		await nextTick();

		filters.value.types = ['t1'];

		await vi.advanceTimersByTimeAsync(debounceMs);
		await nextTick();

		expect(replaceSpy).toHaveBeenCalled();
		expect(routeQuery.value).toEqual({ search: 'x', types: ['t1'], foo: 'bar' }); // unknown 'foo' pruned

		// back to defaults removes keys
		filters.value.search = undefined;

		await vi.advanceTimersByTimeAsync(debounceMs);
		await nextTick();

		filters.value.types = [];

		await vi.advanceTimersByTimeAsync(debounceMs);
		await nextTick();

		expect(routeQuery.value).toEqual({ foo: 'bar' });
	});

	it('sort → URL: omits nulls and drops when equals defaults', async () => {
		const debounceMs = 150;

		const { sort } = useListQuery({
			key: 'k5',
			filters: { schema: FilterSchema, defaults: defaultFilters },
			pagination: { defaults: defaultPagination },
			sort: { defaults: defaultSort },
			syncQuery: true,
			version: 1,
			debounceMs,
		});

		// equals defaults -> absent
		await vi.advanceTimersByTimeAsync(debounceMs);
		await nextTick();

		expect(routeQuery.value).toEqual({});

		// different sort -> present
		sort.value = [{ by: 'name', dir: 'desc' }];

		await vi.advanceTimersByTimeAsync(debounceMs);
		await nextTick();

		expect(routeQuery.value).toEqual({ sort: ['name:desc'] });

		// null dir -> sanitized out → empty → removed
		sort.value = [{ by: 'name', dir: null }];

		await vi.advanceTimersByTimeAsync(debounceMs);
		await nextTick();

		expect(routeQuery.value).toEqual({});
	});
});
