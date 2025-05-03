import { type Ref, nextTick, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IHomeAssistantDiscoveredDevice } from '../store/home-assistant-discovered-devices.store.types';

import { defaultDevicesFilter, useDiscoveredDevicesDataSource } from './useDiscoveredDevicesDataSource';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');
	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useDiscoveredDevicesDataSource', () => {
	let mockStore: {
		findAll: Mock;
		fetch: Mock;
		semaphore: Ref;
		firstLoad: Ref;
	};
	let mockDevices: IHomeAssistantDiscoveredDevice[];

	beforeEach(() => {
		setActivePinia(createPinia());

		mockDevices = [
			{
				id: '1',
				name: 'Light',
				entities: [],
				adoptedDeviceId: null,
			} as IHomeAssistantDiscoveredDevice,
			{
				id: '2',
				name: 'Plug',
				entities: [],
				adoptedDeviceId: 'adopted-device-1',
			} as IHomeAssistantDiscoveredDevice,
		];

		mockStore = {
			findAll: vi.fn(() => mockDevices),
			fetch: vi.fn(),
			semaphore: ref({ fetching: { items: false } }),
			firstLoad: ref(true),
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('fetches devices correctly', async () => {
		const { fetchDiscoveredDevices } = useDiscoveredDevicesDataSource();

		await fetchDiscoveredDevices();

		expect(mockStore.fetch).toHaveBeenCalled();
	});

	it('returns devices', () => {
		const { discoveredDevices } = useDiscoveredDevicesDataSource();

		expect(discoveredDevices.value.length).toBe(2);
	});

	it('filters devices by search text', () => {
		const { filters, discoveredDevices } = useDiscoveredDevicesDataSource();

		filters.value.search = 'plug';

		expect(discoveredDevices.value).toEqual([mockDevices[1]]);
	});

	it('filters devices by adoption status', () => {
		const { filters, discoveredDevices } = useDiscoveredDevicesDataSource();

		filters.value.adopted = true;

		expect(discoveredDevices.value).toEqual([mockDevices[1]]);
	});

	it('sorts devices in ascending order by default', () => {
		const { discoveredDevices } = useDiscoveredDevicesDataSource();

		expect(discoveredDevices.value.map((d) => d.name)).toEqual(['Light', 'Plug']);
	});

	it('paginates devices', () => {
		const { discoveredDevicesPaginated, paginateSize, paginatePage } = useDiscoveredDevicesDataSource();

		paginateSize.value = 1;
		paginatePage.value = 2;

		expect(discoveredDevicesPaginated.value).toEqual([mockDevices[1]]);
	});

	it('tracks filtersActive correctly', () => {
		const { filters, filtersActive } = useDiscoveredDevicesDataSource();

		expect(filtersActive.value).toBe(false);

		filters.value.search = 'something';

		expect(filtersActive.value).toBe(true);
	});

	it('resets filters to default', () => {
		const { filters, resetFilter } = useDiscoveredDevicesDataSource();

		filters.value.search = 'abc';
		filters.value.adopted = true;

		resetFilter();

		expect(filters.value).toEqual(defaultDevicesFilter);
	});

	it('updates pagination page on filter change', async () => {
		const { filters, paginatePage } = useDiscoveredDevicesDataSource();

		paginatePage.value = 3;

		filters.value.search = 'abc';

		await nextTick();

		expect(paginatePage.value).toBe(1);
	});

	it('handles areLoading correctly based on flags', () => {
		const { areLoading } = useDiscoveredDevicesDataSource();

		mockStore.semaphore.value.fetching.items = true;
		expect(areLoading.value).toBe(true);

		mockStore.firstLoad.value = true;
		mockStore.semaphore.value.fetching.items = false;
		expect(areLoading.value).toBe(false);
	});

	it('returns correct total rows', () => {
		const { totalRows } = useDiscoveredDevicesDataSource();

		expect(totalRows.value).toBe(2);
	});
});
