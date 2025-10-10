import { createPinia, setActivePinia } from 'pinia';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registerListQueryStore } from './list.query.store';

// Helpers
const KEY = 'test:list';
const VERSION = 1;

type DataShape = {
	filters?: Record<string, string | number | boolean | (string | number | boolean)[]> | undefined;
	sort?: Array<{ by: string; dir: 'asc' | 'desc' | null }>;
	pagination?: { page?: number; size?: number };
};

describe('list.query.store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		localStorage.clear();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
	});

	it('get() returns undefined when entry is missing', () => {
		const store = registerListQueryStore(createPinia());

		const v = store.get<DataShape>({ key: KEY, expectedVersion: VERSION });

		expect(v).toBeUndefined();
	});

	it('set() stores entry with version and updatedAt; get() returns data for matching version', () => {
		const store = registerListQueryStore(createPinia());

		const data: DataShape = { filters: { q: 'abc' }, sort: [{ by: 'name', dir: 'asc' }], pagination: { page: 2, size: 50 } };

		store.set({ key: KEY, data, version: VERSION });

		// inspect raw entry
		const entry = store.entries[KEY];

		expect(entry).toBeDefined();
		expect(entry?.version).toBe(VERSION);
		expect(typeof entry?.updatedAt).toBe('number');
		expect(entry?.updatedAt).toBe(Date.now());

		// read via get()
		const read = store.get<DataShape>({ key: KEY, expectedVersion: VERSION });

		expect(read).toEqual(data);
	});

	it('get() returns undefined when expectedVersion does not match', () => {
		const store = registerListQueryStore(createPinia());

		store.set({
			key: KEY,
			version: VERSION,
			data: { filters: { search: 'x' } } as DataShape,
		});

		const wrong = store.get<DataShape>({ key: KEY, expectedVersion: VERSION + 1 });

		expect(wrong).toBeUndefined();
	});

	it('patch() merges data with existing entry and updates updatedAt', () => {
		const store = registerListQueryStore(createPinia());

		store.set({
			key: KEY,
			version: VERSION,
			data: { filters: { enabled: 'all' } } as DataShape,
		});

		// advance time to check updatedAt changes
		vi.setSystemTime(new Date('2025-01-01T00:00:01.000Z'));

		store.patch({
			key: KEY,
			version: VERSION,
			data: { pagination: { page: 3, size: 25 } } as DataShape,
		});

		const entry = store.entries[KEY];

		expect(entry?.updatedAt).toBe(Date.now());

		const merged = store.get<DataShape>({ key: KEY, expectedVersion: VERSION });

		expect(merged).toEqual({
			filters: { enabled: 'all' },
			pagination: { page: 3, size: 25 },
		});
	});

	it('reset() removes a single entry', () => {
		const store = registerListQueryStore(createPinia());

		store.set({ key: KEY, version: VERSION, data: { filters: { x: 1 } } as DataShape });

		expect(store.get<DataShape>({ key: KEY, expectedVersion: VERSION })).toBeDefined();

		store.reset({ key: KEY });

		expect(store.get<DataShape>({ key: KEY, expectedVersion: VERSION })).toBeUndefined();
		expect(store.entries[KEY]).toBeUndefined();
	});

	it('clear() removes all entries', () => {
		const store = registerListQueryStore(createPinia());

		store.set({ key: KEY, version: VERSION, data: { filters: { a: 1 } } as DataShape });
		store.set({ key: KEY + ':2', version: VERSION, data: { filters: { b: 2 } } as DataShape });

		expect(store.entries[KEY]).toBeDefined();
		expect(store.entries[KEY + ':2']).toBeDefined();

		store.clear();

		expect(store.entries[KEY]).toBeUndefined();
		expect(store.entries[KEY + ':2']).toBeUndefined();

		// Also ensure localStorage backing was cleared under the store's key
		// (vueuse serializes the whole object)
		const raw = localStorage.getItem('fb:listQuery:v1');

		expect(raw).toBe('{}');
	});

	it('patch() on non-existing key behaves like set() with merged empty object', () => {
		const store = registerListQueryStore(createPinia());

		vi.setSystemTime(new Date('2025-01-01T00:00:02.000Z'));

		store.patch({ key: KEY, version: VERSION, data: { sort: [{ by: 'name', dir: 'asc' }] } });

		const entry = store.entries[KEY];

		expect(entry?.version).toBe(VERSION);
		expect(entry?.updatedAt).toBe(Date.now());

		const v = store.get<DataShape>({ key: KEY, expectedVersion: VERSION });

		expect(v).toEqual({ sort: [{ by: 'name', dir: 'asc' }] });
	});
});
