import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { ICard, IPageBase, ITile, TileParentType } from '../store';

import { useTiles } from './useTiles';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useTiles', () => {
	const pageId = 'page-1';

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
			'tile-1': { id: 'tile-1', page: pageId } as ITile,
			'tile-2': { id: 'tile-2', page: 'page-2' } as ITile,
		};

		semaphore = ref({
			fetching: {
				items: [],
			},
		});

		firstLoad = ref([]);

		fetch = vi.fn();
		findForParent = vi.fn((_parent: TileParentType, parentId: IPageBase['id'] | ICard['id']) =>
			Object.values(data).filter((tile) => 'page' in tile && tile.page === parentId)
		);

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
		const { tiles } = useTiles({ parent: 'page', pageId });

		expect(tiles.value).toEqual([{ id: 'tile-1', page: pageId }]);
	});

	it('should call fetchTile', async () => {
		const { fetchTiles } = useTiles({ parent: 'page', pageId });

		await fetchTiles();

		expect(fetch).toHaveBeenCalledWith({ parent: 'page', pageId });
	});

	it('should return areLoading = true if fetching includes pageId', () => {
		semaphore.value.fetching.items.push(pageId);

		const { areLoading } = useTiles({ parent: 'page', pageId });

		expect(areLoading.value).toBe(true);
	});

	it('should return areLoading = false if firstLoad includes pageId', () => {
		firstLoad.value.push(pageId);

		const { areLoading } = useTiles({ parent: 'page', pageId });

		expect(areLoading.value).toBe(false);
	});

	it('should return loaded = true if firstLoad includes pageId', () => {
		firstLoad.value.push(pageId);

		const { loaded } = useTiles({ parent: 'page', pageId });

		expect(loaded.value).toBe(true);
	});

	it('should return loaded = false if firstLoad does not include pageId', () => {
		const { loaded } = useTiles({ parent: 'page', pageId });

		expect(loaded.value).toBe(false);
	});
});
