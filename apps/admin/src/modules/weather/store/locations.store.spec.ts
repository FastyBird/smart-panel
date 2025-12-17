import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { WeatherApiException, WeatherValidationException } from '../weather.exceptions';

import { useWeatherLocations } from './locations.store';

const mockLocationRes = {
	id: '123e4567-e89b-12d3-a456-426614174000',
	type: 'weather-openweathermap',
	name: 'Home',
	order: 0,
	created_at: '2025-01-15T10:30:00Z',
	updated_at: '2025-01-16T14:20:00Z',
};

const mockLocation = {
	id: '123e4567-e89b-12d3-a456-426614174000',
	type: 'weather-openweathermap',
	name: 'Home',
	order: 0,
	draft: false,
	createdAt: new Date('2025-01-15T10:30:00Z'),
	updatedAt: new Date('2025-01-16T14:20:00Z'),
};

const mockLocationRes2 = {
	id: '223e4567-e89b-12d3-a456-426614174001',
	type: 'weather-openweathermap',
	name: 'Office',
	order: 0,
	created_at: '2025-01-17T08:00:00Z',
	updated_at: null,
};

const mockLocation2 = {
	id: '223e4567-e89b-12d3-a456-426614174001',
	type: 'weather-openweathermap',
	name: 'Office',
	order: 0,
	draft: false,
	createdAt: new Date('2025-01-17T08:00:00Z'),
	updatedAt: null,
};

const backendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
	PATCH: vi.fn(),
	DELETE: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: () => ({
			client: backendClient,
		}),
		useLogger: vi.fn(() => ({
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		})),
		getErrorReason: () => 'Some error',
	};
});

describe('WeatherLocations Store', () => {
	let store: ReturnType<typeof useWeatherLocations>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useWeatherLocations();

		vi.clearAllMocks();
	});

	describe('state', () => {
		it('should have initial empty state', () => {
			expect(store.data).toEqual({});
			expect(store.firstLoad).toBe(false);
			expect(store.semaphore.fetching.items).toBe(false);
			expect(store.semaphore.fetching.item).toEqual([]);
		});

		it('should return firstLoadFinished as false initially', () => {
			expect(store.firstLoadFinished()).toBe(false);
		});

		it('should return fetching as false initially', () => {
			expect(store.fetching()).toBe(false);
		});

		it('should return getting as false for any id initially', () => {
			expect(store.getting('some-id')).toBe(false);
		});
	});

	describe('set', () => {
		it('should set location data successfully', () => {
			const result = store.set({ id: mockLocation.id, data: mockLocation });

			expect(result).toEqual(mockLocation);
			expect(store.data[mockLocation.id]).toEqual(mockLocation);
		});

		it('should update existing location', () => {
			store.set({ id: mockLocation.id, data: mockLocation });
			const updatedData = { ...mockLocation, name: 'Updated Home' };
			const result = store.set({ id: mockLocation.id, data: updatedData });

			expect(result.name).toBe('Updated Home');
			expect(store.data[mockLocation.id].name).toBe('Updated Home');
		});

		it('should throw validation error for invalid data', () => {
			expect(() =>
				store.set({
					id: 'invalid-uuid',
					data: { ...mockLocation, id: 'invalid-uuid' },
				})
			).toThrow(WeatherValidationException);
		});
	});

	describe('unset', () => {
		it('should remove location from store', () => {
			store.set({ id: mockLocation.id, data: mockLocation });
			expect(store.data[mockLocation.id]).toBeDefined();

			store.unset({ id: mockLocation.id });
			expect(store.data[mockLocation.id]).toBeUndefined();
		});

		it('should handle unset of non-existent location', () => {
			expect(() => store.unset({ id: 'non-existent' })).not.toThrow();
		});
	});

	describe('findAll', () => {
		it('should return empty array when no locations', () => {
			expect(store.findAll()).toEqual([]);
		});

		it('should return all locations', () => {
			store.set({ id: mockLocation.id, data: mockLocation });
			store.set({ id: mockLocation2.id, data: mockLocation2 });

			const result = store.findAll();
			expect(result).toHaveLength(2);
		});
	});

	describe('findById', () => {
		it('should return null for non-existent location', () => {
			expect(store.findById('non-existent')).toBeNull();
		});

		it('should return location by id', () => {
			store.set({ id: mockLocation.id, data: mockLocation });

			const result = store.findById(mockLocation.id);
			expect(result).toEqual(mockLocation);
		});
	});

	describe('onEvent', () => {
		it('should handle event and set location', () => {
			const result = store.onEvent({ id: mockLocation.id, data: mockLocationRes });

			expect(result.id).toBe(mockLocation.id);
			expect(result.name).toBe(mockLocation.name);
		});
	});

	describe('get', () => {
		it('should fetch single location from API', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: { data: mockLocationRes },
				error: undefined,
				response: { status: 200 },
			});

			const result = await store.get({ id: mockLocation.id });

			expect(result.id).toBe(mockLocation.id);
			expect(result.name).toBe(mockLocation.name);
			expect(backendClient.GET).toHaveBeenCalled();
		});

		it('should return cached non-draft location without API call', async () => {
			store.set({ id: mockLocation.id, data: mockLocation });

			const result = await store.get({ id: mockLocation.id });

			expect(result).toEqual(mockLocation);
			expect(backendClient.GET).not.toHaveBeenCalled();
		});

		it('should throw error on API failure', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: undefined,
				error: new Error('Network error'),
				response: { status: 500 },
			});

			await expect(store.get({ id: mockLocation.id })).rejects.toThrow(WeatherApiException);
		});

		it('should deduplicate concurrent get requests', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: { data: mockLocationRes },
				error: undefined,
				response: { status: 200 },
			});

			const promise1 = store.get({ id: mockLocation.id });
			const promise2 = store.get({ id: mockLocation.id });

			const [result1, result2] = await Promise.all([promise1, promise2]);

			expect(result1.id).toBe(mockLocation.id);
			expect(result2.id).toBe(mockLocation.id);
			expect(backendClient.GET).toHaveBeenCalledTimes(1);
		});
	});

	describe('fetch', () => {
		it('should fetch all locations from API', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: { data: [mockLocationRes, mockLocationRes2] },
				error: undefined,
				response: { status: 200 },
			});

			const result = await store.fetch();

			expect(result).toHaveLength(2);
			expect(store.firstLoad).toBe(true);
			expect(store.firstLoadFinished()).toBe(true);
		});

		it('should throw error on API failure', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: undefined,
				error: new Error('Network error'),
				response: { status: 500 },
			});

			await expect(store.fetch()).rejects.toThrow(WeatherApiException);
		});

		it('should deduplicate concurrent fetch requests', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: { data: [mockLocationRes] },
				error: undefined,
				response: { status: 200 },
			});

			const promise1 = store.fetch();
			const promise2 = store.fetch();

			await Promise.all([promise1, promise2]);

			expect(backendClient.GET).toHaveBeenCalledTimes(1);
		});
	});

	describe('add', () => {
		it('should add draft location without API call', async () => {
			const result = await store.add({
				id: mockLocation.id,
				draft: true,
				data: {
					type: mockLocation.type,
					name: mockLocation.name,
				},
			});

			expect(result.id).toBe(mockLocation.id);
			expect(result.draft).toBe(true);
			expect(backendClient.POST).not.toHaveBeenCalled();
		});

		it('should add non-draft location with API call', async () => {
			(backendClient.POST as Mock).mockResolvedValue({
				data: { data: mockLocationRes },
				error: undefined,
				response: { status: 201 },
			});

			const result = await store.add({
				id: mockLocation.id,
				draft: false,
				data: {
					type: mockLocation.type,
					name: mockLocation.name,
				},
			});

			expect(result.id).toBe(mockLocation.id);
			expect(result.draft).toBe(false);
			expect(backendClient.POST).toHaveBeenCalled();
		});

		it('should throw validation error for invalid data', async () => {
			await expect(
				store.add({
					id: 'invalid-uuid',
					draft: false,
					data: {
						type: mockLocation.type,
						name: mockLocation.name,
					},
				})
			).rejects.toThrow(WeatherValidationException);
		});

		it('should rollback on API failure', async () => {
			(backendClient.POST as Mock).mockResolvedValue({
				data: undefined,
				error: { status: 500, message: 'Server error' },
				response: { status: 500 },
			});

			await expect(
				store.add({
					id: mockLocation.id,
					draft: false,
					data: {
						type: mockLocation.type,
						name: mockLocation.name,
					},
				})
			).rejects.toThrow(WeatherApiException);

			expect(store.findById(mockLocation.id)).toBeNull();
		});
	});

	describe('edit', () => {
		it('should edit draft location without API call', async () => {
			await store.add({
				id: mockLocation.id,
				draft: true,
				data: {
					type: mockLocation.type,
					name: mockLocation.name,
				},
			});

			const result = await store.edit({
				id: mockLocation.id,
				data: { type: mockLocation.type, name: 'Updated Name' },
			});

			expect(result.name).toBe('Updated Name');
			expect(backendClient.PATCH).not.toHaveBeenCalled();
		});

		it('should edit non-draft location with API call', async () => {
			store.set({ id: mockLocation.id, data: mockLocation });

			(backendClient.PATCH as Mock).mockResolvedValue({
				data: { data: { ...mockLocationRes, name: 'Updated Name' } },
				error: undefined,
				response: { status: 200 },
			});

			const result = await store.edit({
				id: mockLocation.id,
				data: { type: mockLocation.type, name: 'Updated Name' },
			});

			expect(result.name).toBe('Updated Name');
			expect(backendClient.PATCH).toHaveBeenCalled();
		});

		it('should throw error for non-existent location', async () => {
			await expect(
				store.edit({
					id: mockLocation.id,
					data: { type: mockLocation.type, name: 'Updated Name' },
				})
			).rejects.toThrow(WeatherApiException);
		});

		it('should throw error if already updating', async () => {
			store.set({ id: mockLocation.id, data: mockLocation });

			(backendClient.PATCH as Mock).mockImplementation(
				() =>
					new Promise((resolve) =>
						setTimeout(
							() =>
								resolve({
									data: { data: mockLocationRes },
									error: undefined,
									response: { status: 200 },
								}),
							100
						)
					)
			);

			const promise1 = store.edit({ id: mockLocation.id, data: { type: mockLocation.type, name: 'Update 1' } });

			await expect(store.edit({ id: mockLocation.id, data: { type: mockLocation.type, name: 'Update 2' } })).rejects.toThrow(
				WeatherApiException
			);

			await promise1;
		});

		it('should rollback on API failure', async () => {
			store.set({ id: mockLocation.id, data: mockLocation });

			(backendClient.PATCH as Mock).mockResolvedValue({
				data: undefined,
				error: { status: 500, message: 'Server error' },
				response: { status: 500 },
			});

			await expect(
				store.edit({
					id: mockLocation.id,
					data: { type: mockLocation.type, name: 'Updated Name' },
				})
			).rejects.toThrow(WeatherApiException);

			expect(store.findById(mockLocation.id)?.name).toBe(mockLocation.name);
		});
	});

	describe('save', () => {
		it('should save draft location with API call', async () => {
			await store.add({
				id: mockLocation.id,
				draft: true,
				data: {
					type: mockLocation.type,
					name: mockLocation.name,
				},
			});

			(backendClient.POST as Mock).mockResolvedValue({
				data: { data: mockLocationRes },
				error: undefined,
				response: { status: 201 },
			});

			const result = await store.save({ id: mockLocation.id });

			expect(result.draft).toBe(false);
			expect(backendClient.POST).toHaveBeenCalled();
		});

		it('should return existing location if not draft', async () => {
			store.set({ id: mockLocation.id, data: mockLocation });

			const result = await store.save({ id: mockLocation.id });

			expect(result).toEqual(mockLocation);
			expect(backendClient.POST).not.toHaveBeenCalled();
		});

		it('should throw error for non-existent location', async () => {
			await expect(store.save({ id: 'non-existent' })).rejects.toThrow(WeatherApiException);
		});
	});

	describe('remove', () => {
		it('should remove draft location without API call', async () => {
			await store.add({
				id: mockLocation.id,
				draft: true,
				data: {
					type: mockLocation.type,
					name: mockLocation.name,
				},
			});

			const result = await store.remove({ id: mockLocation.id });

			expect(result).toBe(true);
			expect(store.findById(mockLocation.id)).toBeNull();
			expect(backendClient.DELETE).not.toHaveBeenCalled();
		});

		it('should remove non-draft location with API call', async () => {
			store.set({ id: mockLocation.id, data: mockLocation });

			(backendClient.DELETE as Mock).mockResolvedValue({
				data: undefined,
				error: undefined,
				response: { status: 204 },
			});

			const result = await store.remove({ id: mockLocation.id });

			expect(result).toBe(true);
			expect(backendClient.DELETE).toHaveBeenCalled();
		});

		it('should return true for non-existent location', async () => {
			const result = await store.remove({ id: 'non-existent' });

			expect(result).toBe(true);
		});

		it('should throw error if already deleting', async () => {
			store.set({ id: mockLocation.id, data: mockLocation });

			(backendClient.DELETE as Mock).mockImplementation(
				() =>
					new Promise((resolve) =>
						setTimeout(
							() =>
								resolve({
									data: undefined,
									error: undefined,
									response: { status: 204 },
								}),
							100
						)
					)
			);

			const promise1 = store.remove({ id: mockLocation.id });

			await expect(store.remove({ id: mockLocation.id })).rejects.toThrow(WeatherApiException);

			await promise1;
		});
	});
});
