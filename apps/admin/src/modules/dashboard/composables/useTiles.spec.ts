import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { ITile } from '../store/tiles.store.types';

import { useTiles } from './useTiles';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useTiles', () => {
	const parentId = 'page-1';

	let data: Record<string, ITile>;
	let semaphore: Ref;
	let firstLoad: Ref;
	let fetch: Mock;
	let findForParent: Mock;
	let mockStore: {
		$id: string;
		fetch: Mock;
		findForParent: Mock;
		semaphore: Ref;
		firstLoad: Ref;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		data = {
			'tile-1': { id: 'tile-1', parent: { type: 'parent', id: parentId } } as ITile,
			'tile-2': { id: 'tile-2', parent: { type: 'parent', id: 'page-2' } } as ITile,
		};

		semaphore = ref({
			fetching: {
				items: [],
			},
		});

		firstLoad = ref([]);

		fetch = vi.fn();
		findForParent = vi.fn((_parent: string, parentId: string) => Object.values(data).filter((tile) => tile && tile.parent.id === parentId));

		mockStore = {
			$id: 'tiles',
			fetch,
			findForParent,
			semaphore,
			firstLoad,
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('should return only tiles matching the page ID', () => {
		const { tiles } = useTiles({ parent: 'page', parentId });

		expect(tiles.value).toEqual([{ id: 'tile-1', parent: { id: parentId, type: 'parent' } }]);
	});

	it('should call fetchTile', async () => {
		const { fetchTiles } = useTiles({ parent: 'page', parentId });

		await fetchTiles();

		expect(fetch).toHaveBeenCalledWith({ parent: { type: 'page', id: parentId } });
	});

	it('should return areLoading = true if fetching includes parentId', () => {
		semaphore.value.fetching.items.push(parentId);

		const { areLoading } = useTiles({ parent: 'page', parentId });

		expect(areLoading.value).toBe(true);
	});

	it('should return areLoading = false if firstLoad includes parentId', () => {
		firstLoad.value.push(parentId);

		const { areLoading } = useTiles({ parent: 'page', parentId });

		expect(areLoading.value).toBe(false);
	});

	it('should return loaded = true if firstLoad includes parentId', () => {
		firstLoad.value.push(parentId);

		const { loaded } = useTiles({ parent: 'page', parentId });

		expect(loaded.value).toBe(true);
	});

	it('should return loaded = false if firstLoad does not include parentId', () => {
		const { loaded } = useTiles({ parent: 'page', parentId });

		expect(loaded.value).toBe(false);
	});
});
