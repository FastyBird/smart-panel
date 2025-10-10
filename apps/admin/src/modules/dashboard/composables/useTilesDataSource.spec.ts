import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { deepClone, injectStoresManager, useListQuery } from '../../../common';
import type { ITile } from '../store/tiles.store.types';

import { defaultTilesFilter, useTilesDataSource } from './useTilesDataSource';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
		useListQuery: vi.fn(),
	};
});

const DefaultFilter = {
	search: undefined,
	types: [],
};

const DefaultPagination = { page: 1, size: 1 };

const DefaultSort = [{ by: 'row', dir: 'asc' }];

describe('useTilesDataSource', () => {
	let mockStore: {
		findForParent: Mock;
		fetch: Mock;
		semaphore: Ref;
		firstLoad: Ref;
	};
	let mockTiles: ITile[];

	beforeEach(() => {
		setActivePinia(createPinia());

		mockTiles = [
			{
				id: '1',
				type: 'some-tile',
				parent: {
					type: 'page',
					id: 'page-1',
				},
				row: 0,
				col: 0,
				rowSpan: 0,
				colSpan: 0,
				hidden: false,
				draft: false,
			} as ITile,
			{
				id: '2',
				type: 'some-tile',
				parent: {
					type: 'page',
					id: 'page-2',
				},
				row: 0,
				col: 0,
				rowSpan: 0,
				colSpan: 0,
				hidden: false,
				draft: false,
			} as ITile,
			{
				id: '3',
				type: 'some-tile',
				parent: {
					type: 'page',
					id: 'page-1',
				},
				row: 1,
				col: 1,
				rowSpan: 0,
				colSpan: 0,
				hidden: false,
				draft: false,
			} as ITile,
			{
				id: '4',
				type: 'some-tile',
				parent: {
					type: 'page',
					id: 'page-1',
				},
				row: 1,
				col: 1,
				rowSpan: 0,
				colSpan: 0,
				hidden: false,
				draft: true,
			} as ITile,
		];

		mockStore = {
			findForParent: vi.fn((parent: string, parentId: string) => mockTiles.filter((tile) => tile.parent.id === parentId)),
			fetch: vi.fn(),
			semaphore: ref({ fetching: { items: [] } }),
			firstLoad: ref(['page-1']),
		};

		const mockFilter = ref(deepClone(DefaultFilter));
		const mockPagination = ref(deepClone(DefaultPagination));
		const mockSort = ref(deepClone(DefaultSort));

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});

		(useListQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			filters: mockFilter,
			sort: mockSort,
			pagination: mockPagination,
			reset: (): void => {
				mockFilter.value = deepClone(DefaultFilter);
				mockPagination.value = deepClone(DefaultPagination);
			},
		});
	});

	it('fetches tiles', async () => {
		const { fetchTiles } = useTilesDataSource({ parent: 'page', parentId: 'page-1' });

		await fetchTiles();

		expect(mockStore.fetch).toHaveBeenCalledWith({ parent: { type: 'page', id: 'page-1' } });
	});

	it('returns non-draft tiles', () => {
		const { tiles } = useTilesDataSource({ parent: 'page', parentId: 'page-1' });

		expect(tiles.value.length).toBe(2);
	});

	it('respects pagination', () => {
		const { tilesPaginated, paginateSize, paginatePage } = useTilesDataSource({ parent: 'page', parentId: 'page-2' });

		paginateSize.value = 1;
		paginatePage.value = 2;

		expect(tilesPaginated.value.length).toBe(0);
	});

	it('filtersActive is false by default', () => {
		const { filtersActive } = useTilesDataSource({ parent: 'page', parentId: 'page-1' });

		expect(filtersActive.value).toBe(false);
	});

	it('filtersActive is true when filters are applied', () => {
		const { filters, filtersActive } = useTilesDataSource({ parent: 'page', parentId: 'page-1' });

		filters.value.types = ['some-tile'];

		expect(filtersActive.value).toBe(true);
	});

	it('resets filters', () => {
		const { filters, resetFilter } = useTilesDataSource({ parent: 'page', parentId: 'page-1' });

		filters.value.types = ['some-tile'];
		resetFilter();

		expect(filters.value).toEqual(defaultTilesFilter);
	});

	it('returns correct totalRows', () => {
		const { totalRows } = useTilesDataSource({ parent: 'page', parentId: 'page-1' });

		expect(totalRows.value).toBe(2);
	});

	it('returns areLoading true if parentId is in fetching.items', () => {
		mockStore.semaphore.value.fetching.items = ['page-2'];

		const { areLoading } = useTilesDataSource({ parent: 'page', parentId: 'page-2' });

		expect(areLoading.value).toBe(true);
	});

	it('returns loaded true if parentId is in firstLoad', () => {
		mockStore.firstLoad.value = ['page-1'];

		const { loaded } = useTilesDataSource({ parent: 'page', parentId: 'page-1' });

		expect(loaded.value).toBe(true);
	});
});
