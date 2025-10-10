import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { deepClone, injectStoresManager, useListQuery } from '../../../common';
import type { IDataSource } from '../store/data-sources.store.types';

import { defaultDataSourcesFilter, useDataSourcesDataSource } from './useDataSourcesDataSource';

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

const DefaultSort = [{ by: 'type', dir: 'asc' }];

describe('useDataSourcesDataSource', () => {
	let mockStore: {
		findForParent: Mock;
		fetch: Mock;
		semaphore: Ref;
		firstLoad: Ref;
	};
	let mockDataSources: IDataSource[];

	beforeEach(() => {
		setActivePinia(createPinia());

		mockDataSources = [
			{
				id: '1',
				type: 'some-data-source',
				parent: {
					type: 'page',
					id: 'page-1',
				},
				draft: false,
			} as IDataSource,
			{
				id: '2',
				type: 'some-data-source',
				parent: {
					type: 'page',
					id: 'page-2',
				},
				draft: false,
			} as IDataSource,
			{
				id: '3',
				type: 'some-data-source',
				parent: {
					type: 'page',
					id: 'page-1',
				},
				draft: false,
			} as IDataSource,
			{
				id: '4',
				type: 'some-data-source',
				parent: {
					type: 'page',
					id: 'page-1',
				},
				draft: true,
			} as IDataSource,
		];

		mockStore = {
			findForParent: vi.fn((_parent: string, parentId: string) => mockDataSources.filter((dataSource) => dataSource.parent.id === parentId)),
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

	it('fetches data sources', async () => {
		const { fetchDataSources } = useDataSourcesDataSource({ parent: 'page', parentId: 'page-1' });

		await fetchDataSources();

		expect(mockStore.fetch).toHaveBeenCalledWith({ parent: { type: 'page', id: 'page-1' } });
	});

	it('returns non-draft data sources', () => {
		const { dataSources } = useDataSourcesDataSource({ parent: 'page', parentId: 'page-1' });

		expect(dataSources.value.length).toBe(2);
	});

	it('respects pagination', () => {
		const { dataSourcesPaginated, paginateSize, paginatePage } = useDataSourcesDataSource({ parent: 'page', parentId: 'page-2' });

		paginateSize.value = 1;
		paginatePage.value = 2;

		expect(dataSourcesPaginated.value.length).toBe(0);
	});

	it('filtersActive is false by default', () => {
		const { filtersActive } = useDataSourcesDataSource({ parent: 'page', parentId: 'page-1' });

		expect(filtersActive.value).toBe(false);
	});

	it('filtersActive is true when filters are applied', () => {
		const { filters, filtersActive } = useDataSourcesDataSource({ parent: 'page', parentId: 'page-1' });

		filters.value.types = ['device-preview'];

		expect(filtersActive.value).toBe(true);
	});

	it('resets filters', () => {
		const { filters, resetFilter } = useDataSourcesDataSource({ parent: 'page', parentId: 'page-1' });

		filters.value.types = ['device-preview'];

		resetFilter();

		expect(filters.value).toEqual(defaultDataSourcesFilter);
	});

	it('returns correct totalRows', () => {
		const { totalRows } = useDataSourcesDataSource({ parent: 'page', parentId: 'page-1' });

		expect(totalRows.value).toBe(2);
	});

	it('returns areLoading true if parentId is in fetching.items', () => {
		mockStore.semaphore.value.fetching.items = ['page-2'];

		const { areLoading } = useDataSourcesDataSource({ parent: 'page', parentId: 'page-2' });

		expect(areLoading.value).toBe(true);
	});

	it('returns loaded true if parentId is in firstLoad', () => {
		mockStore.firstLoad.value = ['page-1'];

		const { loaded } = useDataSourcesDataSource({ parent: 'page', parentId: 'page-1' });

		expect(loaded.value).toBe(true);
	});
});
