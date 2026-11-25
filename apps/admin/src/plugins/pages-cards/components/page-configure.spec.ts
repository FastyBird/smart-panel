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
	findForParent: (_type: string, cardId: string) => cardTiles.value.filter((item) => item.parent.id === cardId),
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
	StateView: { name: 'StateView', template: '<div />' },
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
	useTilesPlugins: () => ({ getElement: () => ({ name: 'Clock' }) }),
}));

vi.mock('./tile-preview.vue', () => ({
	default: { name: 'TilePreview', template: '<div />' },
}));

const CARD = { id: CARD_ID, title: 'Living room', icon: null, order: 1, rows: null, cols: null };

const errorHandler = vi.fn();

const mountConfigure = async (gridLayout: { rows: number; cols: number } | null = { rows: 4, cols: 6 }, cards: unknown[] = [CARD]) => {
	const wrapper = mount(PageConfigure, {
		attachTo: document.body,
		global: { config: { errorHandler } },
		props: {
			page: { id: PAGE_ID, title: 'Climate', icon: null } as never,
			cards: cards as never,
			gridLayout,
			gridCardStyle: {},
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

		errorHandler.mockReset();

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

	it('selects a tile by click or Enter with its place in its card, and opens its form on a double click', async () => {
		cardTiles.value = [{ ...tile('tile-a', false), row: 2, col: 3, rowSpan: 1, colSpan: 2 }];

		const wrapper = await mountConfigure();
		const item = document.querySelector<HTMLElement>('.grid-stack-item')!;

		expect(item.getAttribute('role')).toBe('button');
		expect(item.getAttribute('aria-label')).toBe('Clock, Living room, pagesCardsPlugin.editor.inspector.positionValue');

		item.click();

		expect(wrapper.emitted('selectTile')?.at(-1)).toEqual([{ id: 'tile-a', cardId: CARD_ID, row: 2, col: 3, rowSpan: 1, colSpan: 2 }]);

		item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

		expect(wrapper.emitted('selectTile')).toHaveLength(2);

		item.dispatchEvent(new MouseEvent('dblclick'));

		expect(wrapper.emitted('editTile')?.at(-1)).toEqual(['tile-a', CARD_ID]);

		await wrapper.setProps({ selectedTileId: 'tile-a' });

		expect(item.classList.contains('is-selected')).toBe(true);
	});

	it('removes a tile from its card on request, clears its selection and deletes it on Save', async () => {
		cardTiles.value = [tile('tile-a', false)];
		tilesStore.remove.mockResolvedValue(true);

		const wrapper = await mountConfigure();

		await wrapper.setProps({ selectedTileId: 'tile-a' });

		(wrapper.vm as unknown as { removeTile: (id: string) => void }).removeTile('tile-a');
		await flushPromises();

		// Changed at once, before any timer runs: a window narrowing to phone width right after must not drop the editor
		expect(wrapper.emitted('update:remote-page-changed')?.at(-1)).toEqual([true]);

		expect(document.querySelector('.grid-stack-item')).toBeNull();
		// The card counts what it holds now, not what the store keeps until Save
		expect(wrapper.emitted('tileCounts')?.at(-1)).toEqual([{ [CARD_ID]: 0 }]);
		expect(wrapper.emitted('selectTile')?.at(-1)).toEqual([null]);

		await wrapper.setProps({ remotePageSubmit: true });
		await flushPromises();

		expect(tilesStore.remove).toHaveBeenCalledWith({ id: 'tile-a', parent: { type: 'card', id: CARD_ID } });
	});

	it('selects a card from its heading and adds a tile to it from its button', async () => {
		const wrapper = await mountConfigure();

		await wrapper.get(`[data-test-id="cards-configure-select-${CARD_ID}"]`).trigger('click');

		expect(wrapper.emitted('selectCard')?.at(-1)).toEqual([CARD_ID]);

		await wrapper.get(`[data-test-id="cards-configure-select-${CARD_ID}"]`).trigger('dblclick');

		expect(wrapper.emitted('editCard')?.at(-1)).toEqual([CARD_ID]);

		await wrapper.get(`[data-test-id="cards-configure-add-tile-${CARD_ID}"]`).trigger('click');

		expect(wrapper.emitted('addTile')?.at(-1)).toEqual([CARD_ID]);
	});

	it('rebuilds and unmounts several populated cards without reading a grid it already destroyed', async () => {
		const CARD_B = { ...CARD, id: 'card-2', title: 'Kitchen', order: 2 };

		cardTiles.value = [tile('tile-a', false), { ...tile('tile-b', false), parent: { type: 'card', id: CARD_B.id } }];

		// GridStack calls its listeners from DOM events, where a throw is reported to the window instead of to Vue
		const windowErrors = vi.fn((event: ErrorEvent) => event.preventDefault());

		window.addEventListener('error', windowErrors);

		const wrapper = await mountConfigure({ rows: 4, cols: 6 }, [CARD, CARD_B]);

		expect(document.querySelectorAll('.grid-stack-item')).toHaveLength(2);

		// Another display's grid rebuilds every card
		await wrapper.setProps({ gridLayout: { rows: 3, cols: 5 } });
		await flushPromises();

		expect(document.querySelectorAll('.grid-stack-item')).toHaveLength(2);

		wrapper.unmount();

		window.removeEventListener('error', windowErrors);

		expect(errorHandler).not.toHaveBeenCalled();
		expect(windowErrors).not.toHaveBeenCalled();
	});

	it('still removes a tile that is not in a grid right now, and lets the inspector go', async () => {
		cardTiles.value = [tile('tile-a', false)];
		tilesStore.remove.mockReset().mockResolvedValue(true);

		// No display yet: the cards have no grids to hold the tile
		const wrapper = await mountConfigure(null);

		await wrapper.setProps({ selectedTileId: 'tile-a' });

		(wrapper.vm as unknown as { removeTile: (id: string) => void }).removeTile('tile-a');
		await flushPromises();

		expect(wrapper.emitted('selectTile')?.at(-1)).toEqual([null]);
		expect(wrapper.emitted('update:remote-page-changed')?.at(-1)).toEqual([true]);

		// Once the grids are built the tile stays out of them, and Save deletes it
		await wrapper.setProps({ gridLayout: { rows: 4, cols: 6 } });
		await flushPromises();

		expect(document.querySelector('.grid-stack-item')).toBeNull();

		await wrapper.setProps({ remotePageSubmit: true });
		await flushPromises();

		expect(tilesStore.remove).toHaveBeenCalledWith({ id: 'tile-a', parent: { type: 'card', id: CARD_ID } });
	});
});
