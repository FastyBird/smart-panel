import { type Ref, ref } from 'vue';

import { createPinia, defineStore, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { useConfigApp } from './config-app.store';
import type { IConfigModule } from './config-modules.store.types';
import type { IConfigPlugin } from './config-plugins.store.types';
import { configModulesStoreKey, configPluginsStoreKey } from './keys';

const backendClient = {
	GET: vi.fn(),
};

// Stand-ins for the real config-plugins/config-modules stores: this spec exercises `config-app`
// store's own lazy-memoized `storeToRefs` wiring, not the sibling stores' business logic, so a store
// matching their `{ data: Ref<...> }` shape (plus a `set` compatible with what `config-app.set()`
// calls on them) is enough.
const useFakePluginsStore = defineStore('test-config-plugins', () => {
	const data: Ref<{ [key: string]: IConfigPlugin }> = ref({});

	const set = (payload: { data: IConfigPlugin }): IConfigPlugin => {
		data.value = { ...data.value, [payload.data.type]: payload.data };

		return payload.data;
	};

	return { data, set };
});

const useFakeModulesStore = defineStore('test-config-modules', () => {
	const data: Ref<{ [key: string]: IConfigModule }> = ref({});

	const set = (payload: { data: IConfigModule }): IConfigModule => {
		data.value = { ...data.value, [payload.data.type]: payload.data };

		return payload.data;
	};

	return { data, set };
});

let pluginsStore: ReturnType<typeof useFakePluginsStore>;
let modulesStore: ReturnType<typeof useFakeModulesStore>;

const mockGetStore = vi.fn((key: symbol) => {
	if (key === configPluginsStoreKey) {
		return pluginsStore;
	}

	if (key === configModulesStoreKey) {
		return modulesStore;
	}

	throw new Error('Unexpected store key requested in test');
});

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: vi.fn(() => ({
			client: backendClient,
		})),
		useLogger: vi.fn(() => ({
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		})),
		getErrorReason: vi.fn(() => 'Some error'),
		injectStoresManager: vi.fn(() => ({
			getStore: mockGetStore,
		})),
	};
});

describe('ConfigApp Store', () => {
	let store: ReturnType<typeof useConfigApp>;

	beforeEach(() => {
		setActivePinia(createPinia());

		pluginsStore = useFakePluginsStore();
		modulesStore = useFakeModulesStore();

		store = useConfigApp();

		vi.clearAllMocks();
	});

	it('composes data from the seeded plugins and modules sibling stores', () => {
		store.set({
			data: {
				path: '/config',
				plugins: [{ type: 'plugin-a', enabled: true }],
				modules: [{ type: 'module-a', enabled: true }],
			},
		});

		expect(store.data).toEqual({
			path: '/config',
			plugins: [{ type: 'plugin-a', enabled: true }],
			modules: [{ type: 'module-a', enabled: true }],
		});
	});

	it('stays reactive to a later change on the plugins sibling store made outside config-app.set()', () => {
		store.set({
			data: {
				path: '/config',
				plugins: [{ type: 'plugin-a', enabled: true }],
				modules: [],
			},
		});

		// First read: this is what resolves (and, after the refactor, memoizes) the sibling refs.
		expect(store.data?.plugins).toEqual([{ type: 'plugin-a', enabled: true }]);

		// Something else touches the plugins store directly — e.g. its own set()/onEvent() — without
		// going through config-app at all.
		pluginsStore.data = { 'plugin-a': { type: 'plugin-a', enabled: false } };

		// A later read must still reflect the sibling store's current data, proving the memoized ref
		// is a live reactive proxy and not a one-time snapshot.
		expect(store.data?.plugins).toEqual([{ type: 'plugin-a', enabled: false }]);
	});

	it('returns null before any data has been set', () => {
		expect(store.data).toBeNull();
	});

	it('throws validation error when set with invalid data', () => {
		expect(() =>
			store.set({
				data: { path: '', plugins: [], modules: [] },
			})
		).toThrow();
	});

	it('fetches app config and populates sibling stores', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: {
				data: {
					path: '/config',
					plugins: [{ type: 'plugin-a', enabled: true }],
					modules: [{ type: 'module-a', enabled: true }],
				},
			},
			error: undefined,
			response: { status: 200 },
		});

		const result = await store.get();

		expect(result.path).toBe('/config');
		expect(store.data?.plugins).toEqual([{ type: 'plugin-a', enabled: true }]);
		expect(store.data?.modules).toEqual([{ type: 'module-a', enabled: true }]);
	});
});
