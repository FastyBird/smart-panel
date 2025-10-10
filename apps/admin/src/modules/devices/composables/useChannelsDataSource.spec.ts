import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { deepClone, injectStoresManager, useListQuery } from '../../../common';
import { DevicesModuleChannelCategory } from '../../../openapi';
import type { IChannel } from '../store/channels.store.types';

import { defaultChannelsFilter, useChannelsDataSource } from './useChannelsDataSource';

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
	devices: [],
	categories: [],
};

const DefaultPagination = { page: 1, size: 1 };

const DefaultSort = [{ by: 'name', dir: 'asc' }];

describe('useChannelsDataSource', () => {
	let mockStore: {
		findAll: Mock;
		fetch: Mock;
		semaphore: Ref;
		firstLoad: Ref;
	};
	let mockChannels: IChannel[];

	beforeEach(() => {
		setActivePinia(createPinia());

		mockChannels = [
			{
				id: '1',
				name: 'Main Light',
				description: 'Ceiling light',
				category: DevicesModuleChannelCategory.light,
				device: 'device-1',
				draft: false,
			} as IChannel,
			{
				id: '2',
				name: 'Fan',
				description: 'Cooling fan',
				category: DevicesModuleChannelCategory.fan,
				device: 'device-2',
				draft: false,
			} as IChannel,
			{
				id: '3',
				name: 'Draft Channel',
				description: 'Ignore me',
				category: DevicesModuleChannelCategory.generic,
				device: 'device-1',
				draft: true,
			} as IChannel,
		];

		mockStore = {
			findAll: vi.fn(() => mockChannels),
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

	it('fetches channels', async () => {
		const { fetchChannels } = useChannelsDataSource();

		await fetchChannels();

		expect(mockStore.fetch).toHaveBeenCalled();
	});

	it('returns only non-draft channels', () => {
		const { channels } = useChannelsDataSource();

		expect(channels.value.length).toBe(2);
		expect(channels.value.every((c) => !c.draft)).toBe(true);
	});

	it('filters channels by search', () => {
		const { channels, filters } = useChannelsDataSource();
		filters.value.search = 'fan';

		expect(channels.value).toEqual([mockChannels[1]]);
	});

	it('returns only channels for deviceId if passed', () => {
		const { channels } = useChannelsDataSource({ deviceId: 'device-1' });

		expect(channels.value.length).toBe(1);
		expect(channels.value[0].id).toBe('1');
	});

	it('filtersActive is false by default', () => {
		const { filtersActive } = useChannelsDataSource();

		expect(filtersActive.value).toBe(false);
	});

	it('filtersActive is true when filters are applied', () => {
		const { filters, filtersActive } = useChannelsDataSource();

		filters.value.devices = ['device-1'];

		expect(filtersActive.value).toBe(true);
	});

	it('sorts channels by name ascending', () => {
		const { channels } = useChannelsDataSource();

		expect(channels.value.map((c) => c.name)).toEqual(['Fan', 'Main Light']);
	});

	it('paginates channels', () => {
		const { channelsPaginated, paginateSize, paginatePage } = useChannelsDataSource();

		paginateSize.value = 1;
		paginatePage.value = 2;

		expect(channelsPaginated.value.length).toBe(1);
	});

	it('resets filters correctly', () => {
		const { filters, resetFilter } = useChannelsDataSource();

		filters.value.devices = ['device-1'];

		resetFilter();

		expect(filters.value).toEqual(defaultChannelsFilter);
	});

	it('sets areLoading true if fetching includes deviceId', () => {
		mockStore.semaphore.value.fetching.items = ['device-1'];

		const { areLoading } = useChannelsDataSource({ deviceId: 'device-1' });

		expect(areLoading.value).toBe(true);
	});

	it('sets loaded true if firstLoad includes deviceId', () => {
		mockStore.firstLoad.value = ['device-1'];

		const { loaded } = useChannelsDataSource({ deviceId: 'device-1' });

		expect(loaded.value).toBe(true);
	});

	it('computes totalRows correctly', () => {
		const { totalRows } = useChannelsDataSource();

		expect(totalRows.value).toBe(2);
	});
});
