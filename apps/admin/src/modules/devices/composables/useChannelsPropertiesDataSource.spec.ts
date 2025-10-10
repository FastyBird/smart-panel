import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { deepClone, injectStoresManager, useListQuery } from '../../../common';
import { DevicesModuleChannelPropertyCategory, DevicesModuleChannelPropertyData_type } from '../../../openapi';
import type { IChannelProperty } from '../store/channels.properties.store.types';

import { defaultChannelsPropertiesFilter, useChannelsPropertiesDataSource } from './useChannelsPropertiesDataSource';

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
	channels: [],
	categories: [],
	permissions: [],
	dataTypes: [],
};

const DefaultPagination = { page: 1, size: 1 };

const DefaultSort = [{ by: 'category', dir: 'asc' }];

describe('useChannelsPropertiesDataSource', () => {
	let mockStore: {
		findAll: Mock;
		fetch: Mock;
		semaphore: Ref;
		firstLoad: Ref;
	};
	let mockProperties: IChannelProperty[];

	beforeEach(() => {
		setActivePinia(createPinia());

		mockProperties = [
			{
				id: '1',
				name: 'Power',
				category: DevicesModuleChannelPropertyCategory.power,
				channel: 'channel-1',
				draft: false,
			} as IChannelProperty,
			{
				id: '2',
				name: 'Humidity',
				category: DevicesModuleChannelPropertyCategory.humidity,
				channel: 'channel-2',
				draft: false,
			} as IChannelProperty,
			{
				id: '3',
				name: 'Draft Prop',
				category: DevicesModuleChannelPropertyCategory.generic,
				channel: 'channel-1',
				draft: true,
			} as IChannelProperty,
		];

		mockStore = {
			findAll: vi.fn(() => mockProperties),
			fetch: vi.fn(),
			semaphore: ref({ fetching: { items: [] } }),
			firstLoad: ref(['all']),
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

	it('fetches properties', async () => {
		const { fetchProperties } = useChannelsPropertiesDataSource({ channelId: 'channel-1' });

		await fetchProperties();

		expect(mockStore.fetch).toHaveBeenCalledWith({ channelId: 'channel-1' });
	});

	it('returns non-draft properties', () => {
		const { properties } = useChannelsPropertiesDataSource({ channelId: 'channel-1' });

		expect(properties.value.length).toBe(1);
	});

	it('filters by search term', () => {
		const { filters, properties } = useChannelsPropertiesDataSource({ channelId: 'channel-2' });

		filters.value.search = 'humidity';

		expect(properties.value).toEqual([mockProperties[1]]);
	});

	it('respects pagination', () => {
		const { propertiesPaginated, paginateSize, paginatePage } = useChannelsPropertiesDataSource({ channelId: 'channel-1' });

		paginateSize.value = 1;
		paginatePage.value = 2;

		expect(propertiesPaginated.value.length).toBe(0);
	});

	it('filtersActive is false by default', () => {
		const { filtersActive } = useChannelsPropertiesDataSource({ channelId: 'channel-1' });

		expect(filtersActive.value).toBe(false);
	});

	it('filtersActive is true when filters are applied', () => {
		const { filters, filtersActive } = useChannelsPropertiesDataSource({ channelId: 'channel-1' });

		filters.value.categories = [DevicesModuleChannelPropertyCategory.humidity];

		expect(filtersActive.value).toBe(true);
	});

	it('resets filters', () => {
		const { filters, resetFilter } = useChannelsPropertiesDataSource({ channelId: 'channel-1' });

		filters.value.dataTypes = [DevicesModuleChannelPropertyData_type.bool];

		resetFilter();

		expect(filters.value).toEqual(defaultChannelsPropertiesFilter);
	});

	it('returns correct totalRows', () => {
		const { totalRows } = useChannelsPropertiesDataSource({ channelId: 'channel-1' });

		expect(totalRows.value).toBe(1);
	});

	it('returns areLoading true if channelId is in fetching.items', () => {
		mockStore.semaphore.value.fetching.items = ['channel-2'];

		const { areLoading } = useChannelsPropertiesDataSource({ channelId: 'channel-2' });

		expect(areLoading.value).toBe(true);
	});

	it('returns loaded true if channelId is in firstLoad', () => {
		mockStore.firstLoad.value = ['channel-1'];

		const { loaded } = useChannelsPropertiesDataSource({ channelId: 'channel-1' });

		expect(loaded.value).toBe(true);
	});
});
