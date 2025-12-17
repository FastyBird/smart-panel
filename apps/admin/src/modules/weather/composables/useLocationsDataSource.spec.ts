import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IWeatherLocation } from '../store/locations.store.types';

import { defaultLocationsFilter, useLocationsDataSource } from './useLocationsDataSource';

const mockLocation1: IWeatherLocation = {
	id: '123e4567-e89b-12d3-a456-426614174000',
	type: 'weather-openweathermap',
	name: 'Home',
	order: 0,
	draft: false,
	createdAt: new Date('2025-01-15T10:30:00Z'),
	updatedAt: new Date('2025-01-16T14:20:00Z'),
};

const mockLocation2: IWeatherLocation = {
	id: '223e4567-e89b-12d3-a456-426614174001',
	type: 'weather-openweathermap',
	name: 'Office',
	order: 0,
	draft: false,
	createdAt: new Date('2025-01-17T08:00:00Z'),
	updatedAt: null,
};

const mockLocation3: IWeatherLocation = {
	id: '323e4567-e89b-12d3-a456-426614174002',
	type: 'weather-buienradar',
	name: 'Apartment',
	order: 0,
	draft: false,
	createdAt: new Date('2025-01-18T08:00:00Z'),
	updatedAt: null,
};

const mockDraftLocation: IWeatherLocation = {
	id: '423e4567-e89b-12d3-a456-426614174003',
	type: 'weather-openweathermap',
	name: 'Draft',
	order: 0,
	draft: true,
	createdAt: new Date('2025-01-19T08:00:00Z'),
	updatedAt: null,
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

vi.mock('../../config', () => ({
	useConfigModule: () => ({
		configModule: ref({ primaryLocationId: '123e4567-e89b-12d3-a456-426614174000' }),
	}),
}));

describe('useLocationsDataSource', () => {
	let fetch: Mock;
	let findAll: Mock;

	let mockStore: {
		fetch: Mock;
		findAll: Mock;
		$id: string;
		firstLoad: Ref<boolean>;
		semaphore: Ref;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		fetch = vi.fn();
		findAll = vi.fn().mockReturnValue([mockLocation1, mockLocation2, mockLocation3, mockDraftLocation]);

		mockStore = {
			fetch,
			findAll,
			$id: 'weather_module-locations',
			firstLoad: ref(false),
			semaphore: ref({
				fetching: {
					items: false,
					item: [],
				},
			}),
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('should return all non-draft locations', () => {
		const { locations } = useLocationsDataSource();

		expect(locations.value).toHaveLength(3);
	});

	it('should filter out draft locations', () => {
		const { locations } = useLocationsDataSource();

		const hasDraft = locations.value.some((l) => l.draft);
		expect(hasDraft).toBe(false);
	});

	it('should filter locations by search', () => {
		const { locations, filters } = useLocationsDataSource();

		filters.value.search = 'home';

		expect(locations.value).toHaveLength(1);
		expect(locations.value[0].name).toBe('Home');
	});

	it('should filter locations by type', () => {
		const { locations, filters } = useLocationsDataSource();

		filters.value.types = ['weather-buienradar'];

		expect(locations.value).toHaveLength(1);
		expect(locations.value[0].type).toBe('weather-buienradar');
	});

	it('should filter primary locations', () => {
		const { locations, filters } = useLocationsDataSource();

		filters.value.primary = 'primary';

		expect(locations.value).toHaveLength(1);
		expect(locations.value[0].id).toBe('123e4567-e89b-12d3-a456-426614174000');
	});

	it('should filter secondary locations', () => {
		const { locations, filters } = useLocationsDataSource();

		filters.value.primary = 'secondary';

		expect(locations.value).toHaveLength(2);
		expect(locations.value.every((l) => l.id !== '123e4567-e89b-12d3-a456-426614174000')).toBe(true);
	});

	it('should sort locations by name ascending', () => {
		const { locations, sortBy, sortDir } = useLocationsDataSource();

		sortBy.value = 'name';
		sortDir.value = 'ascending';

		expect(locations.value[0].name).toBe('Apartment');
		expect(locations.value[1].name).toBe('Home');
		expect(locations.value[2].name).toBe('Office');
	});

	it('should sort locations by name descending', () => {
		const { locations, sortBy, sortDir } = useLocationsDataSource();

		sortBy.value = 'name';
		sortDir.value = 'descending';

		expect(locations.value[0].name).toBe('Office');
		expect(locations.value[2].name).toBe('Apartment');
	});

	it('should paginate locations', () => {
		const { locationsPaginated, paginateSize, paginatePage } = useLocationsDataSource();

		paginateSize.value = 2;
		paginatePage.value = 1;

		expect(locationsPaginated.value).toHaveLength(2);
	});

	it('should handle second page pagination', () => {
		const { locationsPaginated, paginateSize, paginatePage } = useLocationsDataSource();

		paginateSize.value = 2;
		paginatePage.value = 2;

		expect(locationsPaginated.value).toHaveLength(1);
	});

	it('should return totalRows of non-draft locations', () => {
		const { totalRows } = useLocationsDataSource();

		expect(totalRows.value).toBe(3);
	});

	it('should reset filter to defaults', () => {
		const { filters, resetFilter } = useLocationsDataSource();

		filters.value.search = 'test';
		filters.value.types = ['weather-openweathermap'];
		filters.value.primary = 'primary';

		resetFilter();

		expect(filters.value).toEqual(defaultLocationsFilter);
	});

	it('should detect active filters', () => {
		const { filters, filtersActive } = useLocationsDataSource();

		expect(filtersActive.value).toBe(false);

		filters.value.search = 'test';

		expect(filtersActive.value).toBe(true);
	});

	it('should return areLoading true when fetching items', () => {
		mockStore.semaphore.value.fetching.items = true;

		const { areLoading } = useLocationsDataSource();

		expect(areLoading.value).toBe(true);
	});

	it('should return loaded true when first load is complete', () => {
		mockStore.firstLoad.value = true;

		const { loaded } = useLocationsDataSource();

		expect(loaded.value).toBe(true);
	});

	it('should call store.fetch when fetchLocations is called', async () => {
		const { fetchLocations } = useLocationsDataSource();

		await fetchLocations();

		expect(fetch).toHaveBeenCalled();
	});

	it('should return primaryLocationId', () => {
		const { primaryLocationId } = useLocationsDataSource();

		expect(primaryLocationId.value).toBe('123e4567-e89b-12d3-a456-426614174000');
	});
});
