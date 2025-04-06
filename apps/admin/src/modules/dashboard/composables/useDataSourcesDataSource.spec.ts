import { type Ref, nextTick, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { ICard } from '../store/cards.store.types';
import type { DataSourceParentType, IDataSource, IPageDeviceChannelDataSource } from '../store/dataSources.store.types';
import type { IPage } from '../store/pages.store.types';

import { defaultDataSourcesFilter, useDataSourcesDataSource } from './useDataSourcesDataSource';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');
	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

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
				type: 'device-channel',
				device: 'device-1',
				channel: 'channel-1',
				property: 'property-1',
				page: 'page-1',
				draft: false,
			} as IPageDeviceChannelDataSource,
			{
				id: '2',
				type: 'device-channel',
				device: 'device-2',
				channel: 'channel-2',
				property: 'property-2',
				page: 'page-2',
				draft: false,
			} as IPageDeviceChannelDataSource,
			{
				id: '3',
				type: 'device-channel',
				device: 'device-3',
				channel: 'channel-3',
				property: 'property-3',
				page: 'page-1',
				draft: false,
			} as IPageDeviceChannelDataSource,
			{
				id: '4',
				type: 'device-channel',
				device: 'device-4',
				channel: 'channel-4',
				property: 'property-4',
				page: 'page-1',
				draft: true,
			} as IPageDeviceChannelDataSource,
		];

		mockStore = {
			findForParent: vi.fn((parent: DataSourceParentType, parentId: IPage['id'] | ICard['id']) =>
				mockDataSources.filter((dataSource) => 'page' in dataSource && dataSource.page === parentId)
			),
			fetch: vi.fn(),
			semaphore: ref({ fetching: { items: [] } }),
			firstLoad: ref(['page-1']),
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('fetches data sources', async () => {
		const { fetchDataSources } = useDataSourcesDataSource({ parent: 'page', pageId: 'page-1' });
		await fetchDataSources();
		expect(mockStore.fetch).toHaveBeenCalledWith({ parent: 'page', pageId: 'page-1' });
	});

	it('returns non-draft data sources', () => {
		const { dataSources } = useDataSourcesDataSource({ parent: 'page', pageId: 'page-1' });
		expect(dataSources.value.length).toBe(2);
	});

	it('respects pagination', () => {
		const { dataSourcesPaginated, paginateSize, paginatePage } = useDataSourcesDataSource({ parent: 'page', pageId: 'page-2' });
		paginateSize.value = 1;
		paginatePage.value = 2;
		expect(dataSourcesPaginated.value.length).toBe(0);
	});

	it('filtersActive is false by default', () => {
		const { filtersActive } = useDataSourcesDataSource({ parent: 'page', pageId: 'page-1' });
		expect(filtersActive.value).toBe(false);
	});

	it('filtersActive is true when filters are applied', () => {
		const { filters, filtersActive } = useDataSourcesDataSource({ parent: 'page', pageId: 'page-1' });
		filters.value.types = ['device-preview'];
		expect(filtersActive.value).toBe(true);
	});

	it('resets filters', () => {
		const { filters, resetFilter } = useDataSourcesDataSource({ parent: 'page', pageId: 'page-1' });
		filters.value.types = ['device-preview'];
		resetFilter();
		expect(filters.value).toEqual(defaultDataSourcesFilter);
	});

	it('resets page on filter change', async () => {
		const { filters, paginatePage } = useDataSourcesDataSource({ parent: 'page', pageId: 'page-1' });
		paginatePage.value = 3;
		filters.value.types = ['device-preview'];
		await nextTick();
		expect(paginatePage.value).toBe(1);
	});

	it('returns correct totalRows', () => {
		const { totalRows } = useDataSourcesDataSource({ parent: 'page', pageId: 'page-1' });
		expect(totalRows.value).toBe(2);
	});

	it('returns areLoading true if pageId is in fetching.items', () => {
		mockStore.semaphore.value.fetching.items = ['page-2'];
		const { areLoading } = useDataSourcesDataSource({ parent: 'page', pageId: 'page-2' });
		expect(areLoading.value).toBe(true);
	});

	it('returns loaded true if pageId is in firstLoad', () => {
		mockStore.firstLoad.value = ['page-1'];
		const { loaded } = useDataSourcesDataSource({ parent: 'page', pageId: 'page-1' });
		expect(loaded.value).toBe(true);
	});
});
