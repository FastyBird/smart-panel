import { nextTick, ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import PageConfigure from './page-configure.vue';

const PAGE_ID = 'page-1';
const CARD_ID = 'card-1';

const tile = (id: string, draft: boolean) => ({
	id,
	type: 'tiles-time',
	parent: { type: 'card', id: CARD_ID },
	row: 1,
	col: 1,
	rowSpan: 1,
	colSpan: 1,
	hidden: false,
	draft,
});

const cardTiles = ref<ReturnType<typeof tile>[]>([]);

const tilesStore = {
	findForParent: () => cardTiles.value,
	findById: (_parent: string, id: string) => cardTiles.value.find((item) => item.id === id) ?? null,
	fetch: vi.fn().mockResolvedValue(undefined),
	edit: vi.fn(),
	save: vi.fn(),
	remove: vi.fn(),
};

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('pinia', async (importOriginal) => ({
	...(await importOriginal<typeof import('pinia')>()),
	storeToRefs: () => ({ firstLoad: ref<string[]>([]), semaphore: ref({ fetching: { items: [] as string[] } }) }),
}));

vi.mock('../../../common', () => ({
	injectStoresManager: () => ({ getStore: () => tilesStore }),
}));

vi.mock('../../../common/components/empty-state.vue', () => ({
	default: { name: 'EmptyState', template: '<div />' },
}));

vi.mock('../../../modules/dashboard', () => ({
	DashboardException: class extends Error {},
	DisplaySurface: { name: 'DisplaySurface', template: '<div><slot /></div>' },
	FormResult: { NONE: 'none', WORKING: 'working', ERROR: 'error', OK: 'ok' },
	useDataSources: () => ({ dataSources: ref([]), fetchDataSources: vi.fn().mockResolvedValue(undefined) }),
	useDataSourcesActions: () => ({ remove: vi.fn() }),
	useDataSourcesPlugins: () => ({ getElement: () => undefined }),
}));

vi.mock('./tile-preview.vue', () => ({
	default: { name: 'TilePreview', template: '<div />' },
}));

const mountConfigure = async (gridLayout: { rows: number; cols: number } | null = { rows: 4, cols: 6 }) => {
	const wrapper = mount(PageConfigure, {
		attachTo: document.body,
		props: {
			page: { id: PAGE_ID, title: 'Climate', icon: null } as never,
			cards: [{ id: CARD_ID, title: 'Living room', icon: null, order: 1, rows: null, cols: null }] as never,
			gridLayout,
			gridCardStyle: {},
			displays: [],
			selectedDisplay: null,
		},
	});

	await nextTick();
	await flushPromises();

	// The canvas starts tracking changes once its grids are built
	vi.advanceTimersByTime(600);
	await flushPromises();

	return wrapper;
};

enableAutoUnmount(afterEach);

describe('CardsPageConfigure', () => {
	beforeEach(() => {
		vi.useFakeTimers();

		// GridStack watches its container; jsdom has no ResizeObserver
		vi.stubGlobal(
			'ResizeObserver',
			class {
				observe(): void {}
				unobserve(): void {}
				disconnect(): void {}
			}
		);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('starts clean with saved tiles only', async () => {
		cardTiles.value = [tile('tile-a', false)];

		const wrapper = await mountConfigure();

		expect(wrapper.emitted('update:remote-page-changed')).toBeUndefined();
	});

	it('starts changed when a tile added while it was away is still a draft, so Save can store it', async () => {
		cardTiles.value = [tile('tile-a', false), tile('tile-b', true)];

		const wrapper = await mountConfigure();

		expect(wrapper.emitted('update:remote-page-changed')?.at(-1)).toEqual([true]);
	});

	it('does not report a save without a display to read the layout from, and stays changed', async () => {
		cardTiles.value = [tile('tile-b', true)];

		const wrapper = await mountConfigure(null);

		expect(wrapper.emitted('update:remote-page-changed')?.at(-1)).toEqual([true]);

		await wrapper.setProps({ remotePageSubmit: true });
		await flushPromises();

		expect(wrapper.emitted('update:remote-page-result')?.at(-1)).toEqual(['error']);
		expect(wrapper.emitted('update:remote-page-result')).not.toContainEqual(['ok']);
		expect(wrapper.emitted('update:remote-page-changed')?.at(-1)).toEqual([true]);
		expect(tilesStore.edit).not.toHaveBeenCalled();
	});
});
