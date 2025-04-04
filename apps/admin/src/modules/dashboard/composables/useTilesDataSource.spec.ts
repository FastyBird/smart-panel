import { type Ref, nextTick, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { ICard, IPageBase, IPageDayWeatherTile, IPageDevicePreviewTile, IPageTimeTile, ITile, TileParentType } from '../store';

import { defaultTilesFilter, useTilesDataSource } from './useTilesDataSource';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');
	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

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
				type: 'device-preview',
				row: 0,
				col: 0,
				rowSpan: 0,
				colSpan: 0,
				device: 'device-1',
				page: 'page-1',
				draft: false,
			} as IPageDevicePreviewTile,
			{
				id: '2',
				type: 'device-preview',
				row: 0,
				col: 0,
				rowSpan: 0,
				colSpan: 0,
				device: 'device-2',
				page: 'page-2',
				draft: false,
			} as IPageDevicePreviewTile,
			{
				id: '3',
				type: 'clock',
				row: 1,
				col: 1,
				rowSpan: 0,
				colSpan: 0,
				page: 'page-1',
				draft: false,
			} as IPageTimeTile,
			{
				id: '4',
				type: 'clock',
				row: 1,
				col: 1,
				rowSpan: 0,
				colSpan: 0,
				page: 'page-1',
				draft: true,
			} as IPageDayWeatherTile,
		];

		mockStore = {
			findForParent: vi.fn((parent: TileParentType, parentId: IPageBase['id'] | ICard['id']) =>
				mockTiles.filter((tile) => 'page' in tile && tile.page === parentId)
			),
			fetch: vi.fn(),
			semaphore: ref({ fetching: { items: [] } }),
			firstLoad: ref(['page-1']),
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('fetches tiles', async () => {
		const { fetchTiles } = useTilesDataSource({ parent: 'page', pageId: 'page-1' });
		await fetchTiles();
		expect(mockStore.fetch).toHaveBeenCalledWith({ parent: 'page', pageId: 'page-1' });
	});

	it('returns non-draft tiles', () => {
		const { tiles } = useTilesDataSource({ parent: 'page', pageId: 'page-1' });
		expect(tiles.value.length).toBe(2);
	});

	it('respects pagination', () => {
		const { tilesPaginated, paginateSize, paginatePage } = useTilesDataSource({ parent: 'page', pageId: 'page-2' });
		paginateSize.value = 1;
		paginatePage.value = 2;
		expect(tilesPaginated.value.length).toBe(0);
	});

	it('filtersActive is false by default', () => {
		const { filtersActive } = useTilesDataSource({ parent: 'page', pageId: 'page-1' });
		expect(filtersActive.value).toBe(false);
	});

	it('filtersActive is true when filters are applied', () => {
		const { filters, filtersActive } = useTilesDataSource({ parent: 'page', pageId: 'page-1' });
		filters.value.types = ['device-preview'];
		expect(filtersActive.value).toBe(true);
	});

	it('resets filters', () => {
		const { filters, resetFilter } = useTilesDataSource({ parent: 'page', pageId: 'page-1' });
		filters.value.types = ['device-preview'];
		resetFilter();
		expect(filters.value).toEqual(defaultTilesFilter);
	});

	it('resets page on filter change', async () => {
		const { filters, paginatePage } = useTilesDataSource({ parent: 'page', pageId: 'page-1' });
		paginatePage.value = 3;
		filters.value.types = ['device-preview'];
		await nextTick();
		expect(paginatePage.value).toBe(1);
	});

	it('returns correct totalRows', () => {
		const { totalRows } = useTilesDataSource({ parent: 'page', pageId: 'page-1' });
		expect(totalRows.value).toBe(2);
	});

	it('returns areLoading true if pageId is in fetching.items', () => {
		mockStore.semaphore.value.fetching.items = ['page-2'];
		const { areLoading } = useTilesDataSource({ parent: 'page', pageId: 'page-2' });
		expect(areLoading.value).toBe(true);
	});

	it('returns loaded true if pageId is in firstLoad', () => {
		mockStore.firstLoad.value = ['page-1'];
		const { loaded } = useTilesDataSource({ parent: 'page', pageId: 'page-1' });
		expect(loaded.value).toBe(true);
	});
});
