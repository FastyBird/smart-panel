import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IWeatherLocation } from '../store/locations.store.types';

import { useLocations } from './useLocations';

const mockLocation: IWeatherLocation = {
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

const mockDraftLocation: IWeatherLocation = {
	id: '323e4567-e89b-12d3-a456-426614174002',
	type: 'weather-openweathermap',
	name: 'Draft Location',
	order: 0,
	draft: true,
	createdAt: new Date('2025-01-18T08:00:00Z'),
	updatedAt: null,
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useLocations', () => {
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
		findAll = vi.fn().mockReturnValue([]);

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

	it('should return empty array when no locations', () => {
		findAll.mockReturnValue([]);

		const { locations } = useLocations();

		expect(locations.value).toEqual([]);
	});

	it('should return all non-draft locations', () => {
		findAll.mockReturnValue([mockLocation, mockLocation2, mockDraftLocation]);

		const { locations } = useLocations();

		expect(locations.value).toHaveLength(2);
		expect(locations.value).toContainEqual(mockLocation);
		expect(locations.value).toContainEqual(mockLocation2);
	});

	it('should filter out draft locations', () => {
		findAll.mockReturnValue([mockDraftLocation]);

		const { locations } = useLocations();

		expect(locations.value).toHaveLength(0);
	});

	it('should return areLoading true when fetching items', () => {
		mockStore.semaphore.value.fetching.items = true;

		const { areLoading } = useLocations();

		expect(areLoading.value).toBe(true);
	});

	it('should return areLoading false when first load is complete', () => {
		mockStore.firstLoad.value = true;
		mockStore.semaphore.value.fetching.items = false;

		const { areLoading } = useLocations();

		expect(areLoading.value).toBe(false);
	});

	it('should return loaded true when first load is complete', () => {
		mockStore.firstLoad.value = true;

		const { loaded } = useLocations();

		expect(loaded.value).toBe(true);
	});

	it('should return loaded false when first load is not complete', () => {
		mockStore.firstLoad.value = false;

		const { loaded } = useLocations();

		expect(loaded.value).toBe(false);
	});

	it('should call store.fetch when fetchLocations is called', async () => {
		const { fetchLocations } = useLocations();

		await fetchLocations();

		expect(fetch).toHaveBeenCalled();
	});
});
