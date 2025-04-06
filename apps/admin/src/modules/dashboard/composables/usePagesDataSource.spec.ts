import { type Ref, nextTick, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IDeviceDetailPage, IPage, ITilesPage } from '../store/pages.store.types';

import { defaultPagesFilter, usePagesDataSource } from './usePagesDataSource';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');
	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

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
				title: 'Device',
				type: 'device-detail',
				order: 0,
				draft: false,
			} as IDeviceDetailPage,
			{
				id: '2',
				title: 'Tiles',
				type: 'tiles',
				order: 1,
				draft: false,
			} as ITilesPage,
			{
				id: '3',
				title: 'Draft page',
				type: 'device-detail',
				order: 1,
				draft: true,
			} as IDeviceDetailPage,
		];

		mockStore = {
			findAll: vi.fn(() => mockPages),
			fetch: vi.fn(),
			semaphore: ref({ fetching: { items: false } }),
			firstLoad: ref(true),
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
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

		filters.value.search = 'Tiles';

		expect(pages.value).toEqual([mockPages[1]]);
	});

	it('filters pages by types', () => {
		const { filters, pages } = usePagesDataSource();

		filters.value.types = ['device-detail'];

		expect(pages.value).toEqual([mockPages[0]]);
	});

	it('sorts pages in ascending order by default', () => {
		const { pages } = usePagesDataSource();

		expect(pages.value.map((d) => d.title)).toEqual(['Device', 'Tiles']);
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

	it('updates pagination page on filter change', async () => {
		const { filters, paginatePage } = usePagesDataSource();

		paginatePage.value = 3;

		filters.value.search = 'abc';

		await nextTick();

		expect(paginatePage.value).toBe(1);
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
