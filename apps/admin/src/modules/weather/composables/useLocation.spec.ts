import { type Ref, computed, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IWeatherLocation } from '../store/locations.store.types';

import { useLocation } from './useLocation';

const mockLocation: IWeatherLocation = {
	id: '123e4567-e89b-12d3-a456-426614174000',
	type: 'weather-openweathermap',
	name: 'Home',
	order: 0,
	draft: false,
	createdAt: new Date('2025-01-15T10:30:00Z'),
	updatedAt: new Date('2025-01-16T14:20:00Z'),
};

const mockDraftLocation: IWeatherLocation = {
	id: '223e4567-e89b-12d3-a456-426614174001',
	type: 'weather-openweathermap',
	name: 'Office',
	order: 0,
	draft: true,
	createdAt: new Date('2025-01-17T08:00:00Z'),
	updatedAt: null,
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useLocation', () => {
	let get: Mock;
	let findById: Mock;
	let getting: Mock;

	let mockStore: {
		get: Mock;
		findById: Mock;
		getting: Mock;
		$id: string;
		semaphore: Ref;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		get = vi.fn();
		findById = vi.fn();
		getting = vi.fn().mockReturnValue(false);

		mockStore = {
			get,
			findById,
			getting,
			$id: 'weather_module-locations',
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

	it('should return location by id', () => {
		findById.mockReturnValue(mockLocation);

		const { location } = useLocation({ id: computed(() => mockLocation.id) });

		expect(location.value).toEqual(mockLocation);
	});

	it('should return null for draft location', () => {
		findById.mockReturnValue(mockDraftLocation);

		const { location } = useLocation({ id: computed(() => mockDraftLocation.id) });

		expect(location.value).toBeNull();
	});

	it('should return null for non-existent location', () => {
		findById.mockReturnValue(null);

		const { location } = useLocation({ id: computed(() => 'non-existent') });

		expect(location.value).toBeNull();
	});

	it('should return isLoading true when fetching single item', () => {
		findById.mockReturnValue(null);
		getting.mockReturnValue(true);

		const { isLoading } = useLocation({ id: computed(() => mockLocation.id) });

		expect(isLoading.value).toBe(true);
	});

	it('should return isLoading true when fetching all items', () => {
		findById.mockReturnValue(null);
		mockStore.semaphore.value.fetching.items = true;

		const { isLoading } = useLocation({ id: computed(() => mockLocation.id) });

		expect(isLoading.value).toBe(true);
	});

	it('should return isLoading false when location is loaded', () => {
		findById.mockReturnValue(mockLocation);
		getting.mockReturnValue(false);

		const { isLoading } = useLocation({ id: computed(() => mockLocation.id) });

		expect(isLoading.value).toBe(false);
	});

	it('should call store.get when fetchLocation is called', async () => {
		const { fetchLocation } = useLocation({ id: computed(() => mockLocation.id) });

		await fetchLocation();

		expect(get).toHaveBeenCalledWith({ id: mockLocation.id });
	});
});
