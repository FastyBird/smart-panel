import { computed, nextTick, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import type { IPlugin } from '../../../common';
import { DASHBOARD_MODULE_NAME } from '../../../modules/dashboard/dashboard.constants';
import { useTiles as useTilesStore } from '../../../modules/dashboard/store/tiles.store';
import type { ITile } from '../../../modules/dashboard/store/tiles.store.types';

import PageConfigure from './page-configure.vue';

/*
 * The editor's delete retry on the real Pinia tiles store, with only the backend client mocked. The store drops a tile
 * before its DELETE and treats a tile it does not hold as removed, so the editor must check the backend first.
 */

const PAGE_ID = '00000000-0000-4000-8000-00000000a001';
const TILE_ID = '00000000-0000-4000-8000-00000000b001';

const backendClient = { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() };

vi.mock('vue-i18n', async (importOriginal) => ({
	...(await importOriginal<typeof import('vue-i18n')>()),
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../common', async () => {
	const utils = await vi.importActual('../../../common/utils/utils');
	const composables = await vi.importActual('../../../common/composables/composables');
	const services = await vi.importActual('../../../common/services/services');
	const store = await vi.importActual('../../../common/store/stores');
	const constants = await vi.importActual('../../../common/common.constants');

	return {
		...utils,
		...composables,
		...services,
		...store,
		...constants,
		useBackend: vi.fn(() => ({ client: backendClient })),
		useLogger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warning: vi.fn(), log: vi.fn(), debug: vi.fn() })),
		useFlashMessage: () => ({ warning: vi.fn() }),
		getErrorReason: vi.fn(() => 'Some error'),
		injectStoresManager: vi.fn(() => ({
			getStore: () => ({ firstLoad: [], set: vi.fn(), unset: vi.fn() }),
		})),
		injectPluginsManager: vi.fn(() => ({
			getPlugins: () => [{ type: 'some-tile', modules: [DASHBOARD_MODULE_NAME] } as IPlugin],
		})),
	};
});

vi.mock('../../../modules/config', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../../modules/config')>()),
	useConfigPlugins: () => ({ enabled: () => true, loaded: ref(true) }),
}));

// The editor's composables, served straight from the real store
let store: ReturnType<typeof useTilesStore>;

vi.mock('../../../modules/dashboard', () => ({
	DisplaySurface: { name: 'DisplaySurface', template: '<div><slot /></div>' },
	FormResult: { NONE: 'none', WORKING: 'working', ERROR: 'error', OK: 'ok' },
	useTiles: () => ({
		tiles: computed<ITile[]>(() => store.findForParent('page', PAGE_ID)),
		fetchTiles: () => store.fetch({ parent: { type: 'page', id: PAGE_ID } }),
	}),
	useTilesActions: () => ({
		findById: (parent: string, id: string) => store.findById(parent, id),
		edit: (payload: Parameters<typeof store.edit>[0]) => store.edit(payload),
		save: (payload: Parameters<typeof store.save>[0]) => store.save(payload),
		removeDirectly: (payload: Parameters<typeof store.remove>[0]) => store.remove(payload),
	}),
	useTilesPlugins: () => ({ getElement: () => ({ name: 'Clock' }) }),
}));

vi.mock('./tile-preview.vue', () => ({
	default: { name: 'TilePreview', template: '<div />' },
}));

const TILE_RES = {
	id: TILE_ID,
	type: 'some-tile',
	parent: { type: 'page', id: PAGE_ID },
	row: 1,
	col: 1,
	row_span: 1,
	col_span: 1,
	hidden: false,
	data_source: [],
	created_at: '2026-10-01T10:00:00Z',
	updated_at: null,
};

const failed = { error: new Error('API failed'), response: { status: 500 } };

enableAutoUnmount(afterEach);

describe('PageConfigure with the tiles store', () => {
	beforeEach(async () => {
		setActivePinia(createPinia());

		store = useTilesStore();

		vi.clearAllMocks();

		(backendClient.GET as Mock).mockResolvedValue({ data: { data: [TILE_RES] }, response: { status: 200 } });

		await store.fetch({ parent: { type: 'page', id: PAGE_ID } });
	});

	it('sends a failed delete again only once the backend confirms the tile is still there', async () => {
		const wrapper = mount(PageConfigure, {
			attachTo: document.body,
			props: { page: { id: PAGE_ID } as never, gridLayout: { rows: 4, cols: 6 } },
		});

		await nextTick();
		await flushPromises();

		const save = async (): Promise<void> => {
			await wrapper.setProps({ remotePageSubmit: false });
			await wrapper.setProps({ remotePageSubmit: true });
			await flushPromises();
		};

		(wrapper.vm as unknown as { removeTile: (id: string) => void }).removeTile(TILE_ID);

		// The DELETE fails, and so do the store's recovery read and the editor's reload: the store forgets the tile
		(backendClient.DELETE as Mock).mockResolvedValue(failed);
		(backendClient.GET as Mock).mockResolvedValue(failed);

		await save();

		expect(wrapper.emitted('update:remote-page-result')?.at(-1)).toEqual(['error']);
		expect(store.findById('page', TILE_ID)).toBeNull();
		expect(backendClient.DELETE).toHaveBeenCalledTimes(1);

		// Retried while the backend still cannot be read: the store would call the tile removed, the editor does not
		await save();

		expect(wrapper.emitted('update:remote-page-result')?.at(-1)).toEqual(['error']);
		expect(backendClient.DELETE).toHaveBeenCalledTimes(1);

		// The backend answers and still has the tile: it comes back to the store and is deleted for real
		(backendClient.GET as Mock).mockResolvedValue({ data: { data: [TILE_RES] }, response: { status: 200 } });
		(backendClient.DELETE as Mock).mockResolvedValue({ response: { status: 204 } });

		await save();

		expect(backendClient.DELETE).toHaveBeenCalledTimes(2);
		expect(wrapper.emitted('update:remote-page-result')?.at(-1)).toEqual(['ok']);
		expect(store.findById('page', TILE_ID)).toBeNull();
	});
});
