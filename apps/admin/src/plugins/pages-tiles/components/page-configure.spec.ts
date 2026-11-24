import { nextTick, ref } from 'vue';

import type { GridItemHTMLElement } from 'gridstack';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import PageConfigure from './page-configure.vue';

const edit = vi.fn();
const save = vi.fn();
const removeDirectly = vi.fn();

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
	useTiles: () => ({ tiles }),
	useTilesActions: () => ({
		findById: (_parent: string, id: string) => tiles.value.find((tile) => tile.id === id) ?? null,
		edit,
		save,
		removeDirectly,
	}),
	useTilesPlugins: () => ({ getElement: () => ({ name: 'Clock' }) }),
}));

vi.mock('./tile-preview.vue', () => ({
	default: { name: 'TilePreview', template: '<div />' },
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
});
