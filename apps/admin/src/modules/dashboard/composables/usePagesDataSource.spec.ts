import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { deepClone, injectStoresManager, useListQuery } from '../../../common';
import type { IPage } from '../store/pages.store.types';

import { defaultPagesFilter, usePagesDataSource } from './usePagesDataSource';

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
	displays: [],
};

const DefaultPagination = { page: 1, size: 1 };

const DefaultSort = [{ by: 'order', dir: 'asc' }];

describe('usePagesDataSource', () => {
	let mockStore: {
		findAll: Mock;
		fetch: Mock;
		semaphore: Ref;
		firstLoad: Ref;
	};
	let mockPages: IPage[];

	beforeEach(() => {
		setActivePinia(createPinia());

		mockPages = [
			{
				id: '1',
				title: 'Page one',
				type: 'some-page',
				order: 0,
				draft: false,
			} as IPage,
			{
				id: '2',
				title: 'Page two',
				type: 'tiles',
				order: 1,
				draft: false,
			} as IPage,
			{
				id: '3',
				title: 'Draft page',
				type: 'some-page',
				order: 1,
				draft: true,
			} as IPage,
		];

		mockStore = {
			findAll: vi.fn(() => mockPages),
			fetch: vi.fn(),
			semaphore: ref({ fetching: { items: false } }),
			firstLoad: ref(true),
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

	it('fetches pages correctly', async () => {
		const { fetchPages } = usePagesDataSource();

		await fetchPages();

		expect(mockStore.fetch).toHaveBeenCalled();
	});

	it('returns only non-draft pages', () => {
		const { pages } = usePagesDataSource();

		expect(pages.value.length).toBe(2);
		expect(pages.value.every((d) => !d.draft)).toBe(true);
	});

	it('filters pages by search text', () => {
		const { filters, pages } = usePagesDataSource();

		filters.value.search = 'Page two';

		expect(pages.value).toEqual([mockPages[1]]);
	});

	it('filters pages by types', () => {
		const { filters, pages } = usePagesDataSource();

		filters.value.types = ['some-page'];

		expect(pages.value).toEqual([mockPages[0]]);
	});

	it('sorts pages in ascending order by default', () => {
		const { pages } = usePagesDataSource();

		expect(pages.value.map((d) => d.title)).toEqual(['Page one', 'Page two']);
	});

	it('paginates pages', () => {
		const { pagesPaginated, paginateSize, paginatePage } = usePagesDataSource();

		paginateSize.value = 1;
		paginatePage.value = 2;

		expect(pagesPaginated.value).toEqual([mockPages[1]]);
	});

	it('tracks filtersActive correctly', () => {
		const { filters, filtersActive } = usePagesDataSource();

		expect(filtersActive.value).toBe(false);

		filters.value.search = 'something';

		expect(filtersActive.value).toBe(true);
	});

	it('resets filters to default', () => {
		const { filters, resetFilter } = usePagesDataSource();

		filters.value.search = 'abc';
		filters.value.types = ['x'];

		resetFilter();

		expect(filters.value).toEqual(defaultPagesFilter);
	});

	it('handles areLoading correctly based on flags', () => {
		const { areLoading } = usePagesDataSource();

		mockStore.semaphore.value.fetching.items = true;
		expect(areLoading.value).toBe(true);

		mockStore.firstLoad.value = true;
		mockStore.semaphore.value.fetching.items = false;
		expect(areLoading.value).toBe(false);
	});

	it('returns correct total rows', () => {
		const { totalRows } = usePagesDataSource();

		expect(totalRows.value).toBe(2);
	});
});
