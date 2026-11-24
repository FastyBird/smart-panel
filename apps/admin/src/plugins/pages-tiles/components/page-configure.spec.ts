import { nextTick, ref } from 'vue';

import type { GridItemHTMLElement } from 'gridstack';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import PageConfigure from './page-configure.vue';

const edit = vi.fn();
const save = vi.fn();
const removeDirectly = vi.fn();
const fetchTiles = vi.fn();

const PAGE_ID = 'page-1';

const tiles = ref([
	{ id: 'tile-a', type: 'tiles-time', parent: { type: 'page', id: PAGE_ID }, row: 1, col: 1, rowSpan: 2, colSpan: 2, hidden: false, draft: false },
	{ id: 'tile-b', type: 'tiles-time', parent: { type: 'page', id: PAGE_ID }, row: 1, col: 4, rowSpan: 1, colSpan: 1, hidden: false, draft: false },
]);

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../common', () => ({
	useFlashMessage: () => ({ warning: vi.fn() }),
}));

vi.mock('../../../modules/dashboard', () => ({
	DisplaySurface: { name: 'DisplaySurface', template: '<div><slot /></div>' },
	FormResult: { NONE: 'none', WORKING: 'working', ERROR: 'error', OK: 'ok' },
	useTiles: () => ({ tiles, fetchTiles }),
	useTilesActions: () => ({
		findById: (_parent: string, id: string) => tiles.value.find((tile) => tile.id === id) ?? null,
		edit,
		save,
		removeDirectly,
	}),
	useTilesPlugins: () => ({ getElement: () => ({ name: 'Clock' }) }),
}));

vi.mock('./tile-preview.vue', () => ({
	default: { name: 'TilePreview', props: ['tile'], template: '<div class="preview" :data-size="`${tile.colSpan}x${tile.rowSpan}`" />' },
}));

const mountConfigure = async () => {
	const wrapper = mount(PageConfigure, {
		attachTo: document.body,
		props: { page: { id: PAGE_ID } as never, gridLayout: { rows: 4, cols: 6 } },
	});

	await nextTick();
	await flushPromises();

	return wrapper;
};

const pageItem = (id: string): GridItemHTMLElement | undefined =>
	[...document.querySelectorAll<GridItemHTMLElement>('[data-test-id="page-configure-canvas"] .grid-stack-item')].find(
		(item) => item.gridstackNode?.id === id
	);

const hiddenItem = (id: string): GridItemHTMLElement | undefined =>
	[...document.querySelectorAll<GridItemHTMLElement>('[data-test-id="page-configure-hidden"] .grid-stack-item')].find(
		(item) => item.gridstackNode?.id === id
	);

enableAutoUnmount(afterEach);

describe('PageConfigure', () => {
	beforeEach(() => {
		edit.mockReset().mockImplementation(async ({ id }: { id: string }) => tiles.value.find((tile) => tile.id === id));
		save.mockReset();
		removeDirectly.mockReset().mockResolvedValue(true);
		fetchTiles.mockReset().mockResolvedValue(undefined);
	});

	it('puts the tiles on the page where they are saved', async () => {
		await mountConfigure();

		expect(pageItem('tile-a')?.gridstackNode).toMatchObject({ x: 0, y: 0, w: 2, h: 2 });
		expect(pageItem('tile-b')?.gridstackNode).toMatchObject({ x: 3, y: 0, w: 1, h: 1 });
	});

	it('keeps the size a tile had on the page, resized or not, when it is hidden, shown and saved', async () => {
		const wrapper = await mountConfigure();
		const exposed = wrapper.vm as unknown as { hideTile: (id: string) => void; showTile: (id: string) => boolean };

		// Resized on the page, not saved yet
		const grid = pageItem('tile-b')!.gridstackNode!.grid!;

		grid.update(pageItem('tile-b')!, { w: 2, h: 1 });

		exposed.hideTile('tile-b');
		await flushPromises();

		expect(pageItem('tile-b')).toBeUndefined();
		expect(hiddenItem('tile-b')).toBeDefined();

		// Saved while hidden: the size goes with it
		await wrapper.setProps({ remotePageSubmit: true });
		await flushPromises();

		expect(edit).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'tile-b', data: expect.objectContaining({ hidden: true, rowSpan: 1, colSpan: 2 }) })
		);

		edit.mockClear();

		exposed.hideTile('tile-a');
		await flushPromises();

		expect(exposed.showTile('tile-a')).toBe(true);
		await flushPromises();

		expect(pageItem('tile-a')?.gridstackNode).toMatchObject({ w: 2, h: 2 });
	});

	it('locks the layout while it is being saved and settles only what it sent', async () => {
		const pending: (() => void)[] = [];
		const finish = (): void => pending.forEach((resolve) => resolve());

		edit.mockImplementation(
			({ id }: { id: string }) =>
				new Promise((resolve) => {
					pending.push(() => resolve(tiles.value.find((tile) => tile.id === id)));
				})
		);

		const wrapper = await mountConfigure();
		const exposed = wrapper.vm as unknown as { hideTile: (id: string) => void; removeTile: (id: string) => void };

		await wrapper.setProps({ remotePageSubmit: true });
		await flushPromises();

		expect(wrapper.emitted('update:remote-page-result')?.at(-1)).toEqual(['working']);

		// Nothing moves under the request
		exposed.hideTile('tile-a');
		exposed.removeTile('tile-b');

		expect(pageItem('tile-a')).toBeDefined();
		expect(pageItem('tile-b')).toBeDefined();

		finish();
		edit.mockImplementation(async ({ id }: { id: string }) => tiles.value.find((tile) => tile.id === id));
		await flushPromises();

		expect(wrapper.emitted('update:remote-page-result')?.at(-1)).toEqual(['ok']);
		expect(removeDirectly).not.toHaveBeenCalled();
	});
	it('gives a hidden tile dragged back onto the page the size it had there, where it fits', async () => {
		const wrapper = await mountConfigure();
		const exposed = wrapper.vm as unknown as { hideTile: (id: string) => void };
		const grid = pageItem('tile-b')!.gridstackNode!.grid!;

		exposed.hideTile('tile-a');
		await flushPromises();

		// What a drop from the panel does: the tile arrives at the panel's size
		grid.addWidget({ id: 'tile-a', x: 0, y: 2, w: 2, h: 1 });
		await nextTick();
		await flushPromises();

		expect(pageItem('tile-a')?.gridstackNode).toMatchObject({ x: 0, y: 2, w: 2, h: 2 });
	});

	it('keeps the dropped size when the saved one would cover another tile', async () => {
		const wrapper = await mountConfigure();
		const exposed = wrapper.vm as unknown as { hideTile: (id: string) => void };
		const grid = pageItem('tile-b')!.gridstackNode!.grid!;

		exposed.hideTile('tile-a');
		await flushPromises();

		grid.addWidget({ id: 'tile-c-blocker', x: 0, y: 3, w: 1, h: 1 });
		grid.addWidget({ id: 'tile-a', x: 0, y: 2, w: 2, h: 1 });
		await nextTick();
		await flushPromises();

		expect(pageItem('tile-a')?.gridstackNode).toMatchObject({ x: 0, y: 2, w: 2, h: 1 });
	});

	it('keeps the grids locked until every request of a failed save has settled', async () => {
		const pending: (() => void)[] = [];

		edit.mockImplementation(({ id }: { id: string }) =>
			id === 'tile-a'
				? Promise.reject(new Error('failed'))
				: new Promise((resolve) => {
						pending.push(() => resolve(tiles.value.find((tile) => tile.id === id)));
					})
		);

		const wrapper = await mountConfigure();
		const exposed = wrapper.vm as unknown as { hideTile: (id: string) => void };

		await wrapper.setProps({ remotePageSubmit: true });
		await flushPromises();

		expect(wrapper.emitted('update:remote-page-result')?.at(-1)).toEqual(['working']);

		exposed.hideTile('tile-a');
		expect(pageItem('tile-a')).toBeDefined();

		pending.forEach((resolve) => resolve());
		await flushPromises();

		expect(wrapper.emitted('update:remote-page-result')?.at(-1)).toEqual(['error']);

		exposed.hideTile('tile-a');
		await flushPromises();

		expect(pageItem('tile-a')).toBeUndefined();
	});
	it('leaves the page clean after filling the grids, and tracks the first edit at once', async () => {
		const wrapper = await mountConfigure();
		const exposed = wrapper.vm as unknown as { hideTile: (id: string) => void };

		expect(wrapper.emitted('update:remote-page-changed')).toBeUndefined();

		exposed.hideTile('tile-b');
		await nextTick();

		expect(wrapper.emitted('update:remote-page-changed')).toEqual([[true]]);
	});

	it('names each tile by its type and place, and draws the preview at the size its cell has', async () => {
		const wrapper = await mountConfigure();
		const exposed = wrapper.vm as unknown as { hideTile: (id: string) => void };
		const grid = pageItem('tile-b')!.gridstackNode!.grid!;

		expect(pageItem('tile-b')?.getAttribute('aria-label')).toBe('Clock, pagesTilesPlugin.editor.inspector.positionValue');

		exposed.hideTile('tile-a');
		await flushPromises();

		grid.addWidget({ id: 'tile-a', x: 0, y: 2, w: 1, h: 1 });
		await nextTick();
		await flushPromises();

		expect(pageItem('tile-a')?.querySelector('.preview')?.getAttribute('data-size')).toBe('2x2');
	});

	it('deletes a removed tile once, and reloads the tiles after a failed delete so a retry sends it again', async () => {
		removeDirectly.mockRejectedValueOnce(new Error('failed')).mockResolvedValue(true);

		const wrapper = await mountConfigure();
		const exposed = wrapper.vm as unknown as { removeTile: (id: string) => void };

		exposed.removeTile('tile-a');
		exposed.removeTile('tile-b');

		await wrapper.setProps({ remotePageSubmit: true });
		await flushPromises();

		expect(wrapper.emitted('update:remote-page-result')?.at(-1)).toEqual(['error']);
		expect(removeDirectly).toHaveBeenCalledTimes(2);
		expect(fetchTiles).toHaveBeenCalledTimes(1);

		await wrapper.setProps({ remotePageSubmit: false });
		await wrapper.setProps({ remotePageSubmit: true });
		await flushPromises();

		// Only the one that failed is sent again, with its page, whatever the store holds
		expect(removeDirectly).toHaveBeenCalledTimes(3);
		expect(removeDirectly).toHaveBeenLastCalledWith({ id: 'tile-a', parent: { type: 'page', id: PAGE_ID } });
		expect(wrapper.emitted('update:remote-page-result')?.at(-1)).toEqual(['ok']);
	});
});
