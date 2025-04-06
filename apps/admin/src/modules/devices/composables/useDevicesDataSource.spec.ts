import { type Ref, nextTick, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import { DevicesDeviceCategory } from '../../../openapi';
import type { IDevice } from '../store/devices.store.types';

import { defaultDevicesFilter, useDevicesDataSource } from './useDevicesDataSource';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');
	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useDevicesDataSource', () => {
	let mockStore: {
		findAll: Mock;
		fetch: Mock;
		semaphore: Ref;
		firstLoad: Ref;
	};
	let mockDevices: IDevice[];

	beforeEach(() => {
		setActivePinia(createPinia());

		mockDevices = [
			{
				id: '1',
				name: 'Light',
				type: 'light',
				category: DevicesDeviceCategory.lighting,
				description: 'A smart light',
				draft: false,
			} as IDevice,
			{
				id: '2',
				name: 'Plug',
				type: 'plug',
				category: DevicesDeviceCategory.outlet,
				description: 'Smart plug',
				draft: false,
			} as IDevice,
			{
				id: '3',
				name: 'Draft device',
				type: 'draft',
				category: DevicesDeviceCategory.generic,
				description: 'Should be filtered out',
				draft: true,
			} as IDevice,
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
		const { fetchDevices } = useDevicesDataSource();

		await fetchDevices();

		expect(mockStore.fetch).toHaveBeenCalled();
	});

	it('returns only non-draft devices', () => {
		const { devices } = useDevicesDataSource();

		expect(devices.value.length).toBe(2);
		expect(devices.value.every((d) => !d.draft)).toBe(true);
	});

	it('filters devices by search text', () => {
		const { filters, devices } = useDevicesDataSource();

		filters.value.search = 'plug';

		expect(devices.value).toEqual([mockDevices[1]]);
	});

	it('filters devices by types', () => {
		const { filters, devices } = useDevicesDataSource();

		filters.value.types = ['light'];

		expect(devices.value).toEqual([mockDevices[0]]);
	});

	it('sorts devices in ascending order by default', () => {
		const { devices } = useDevicesDataSource();

		expect(devices.value.map((d) => d.name)).toEqual(['Light', 'Plug']);
	});

	it('paginates devices', () => {
		const { devicesPaginated, paginateSize, paginatePage } = useDevicesDataSource();

		paginateSize.value = 1;
		paginatePage.value = 2;

		expect(devicesPaginated.value).toEqual([mockDevices[1]]);
	});

	it('tracks filtersActive correctly', () => {
		const { filters, filtersActive } = useDevicesDataSource();

		expect(filtersActive.value).toBe(false);

		filters.value.search = 'something';

		expect(filtersActive.value).toBe(true);
	});

	it('resets filters to default', () => {
		const { filters, resetFilter } = useDevicesDataSource();

		filters.value.search = 'abc';
		filters.value.types = ['x'];

		resetFilter();

		expect(filters.value).toEqual(defaultDevicesFilter);
	});

	it('updates pagination page on filter change', async () => {
		const { filters, paginatePage } = useDevicesDataSource();

		paginatePage.value = 3;

		filters.value.search = 'abc';

		await nextTick();

		expect(paginatePage.value).toBe(1);
	});

	it('handles areLoading correctly based on flags', () => {
		const { areLoading } = useDevicesDataSource();

		mockStore.semaphore.value.fetching.items = true;
		expect(areLoading.value).toBe(true);

		mockStore.firstLoad.value = true;
		mockStore.semaphore.value.fetching.items = false;
		expect(areLoading.value).toBe(false);
	});

	it('returns correct total rows', () => {
		const { totalRows } = useDevicesDataSource();

		expect(totalRows.value).toBe(2);
	});
});
