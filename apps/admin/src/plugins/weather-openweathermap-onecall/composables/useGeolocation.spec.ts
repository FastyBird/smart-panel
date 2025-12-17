import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IGeolocationCity } from './useGeolocation';

import { useGeolocation } from './useGeolocation';

const mockCitiesResponse: IGeolocationCity[] = [
	{
		name: 'London',
		lat: 51.5074,
		lon: -0.1278,
		country: 'GB',
		state: 'England',
		localNames: {
			en: 'London',
			de: 'London',
		},
	},
	{
		name: 'London',
		lat: 42.9834,
		lon: -81.233,
		country: 'CA',
		state: 'Ontario',
	},
];

const backendClient = {
	GET: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: () => ({
			client: backendClient,
		}),
	};
});

describe('useGeolocation', () => {
	beforeEach(() => {
		setActivePinia(createPinia());

		vi.clearAllMocks();
	});

	it('should return initial state', () => {
		const { isSearching } = useGeolocation();

		expect(isSearching.value).toBe(false);
	});

	it('should return empty array for empty query', async () => {
		const { searchCities } = useGeolocation();

		const result = await searchCities('');

		expect(result).toEqual([]);
		expect(backendClient.GET).not.toHaveBeenCalled();
	});

	it('should return empty array for query shorter than 2 characters', async () => {
		const { searchCities } = useGeolocation();

		const result = await searchCities('L');

		expect(result).toEqual([]);
		expect(backendClient.GET).not.toHaveBeenCalled();
	});

	it('should search cities successfully', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: mockCitiesResponse },
			response: { ok: true, status: 200 },
		});

		const { searchCities } = useGeolocation();

		const result = await searchCities('London');

		expect(result).toHaveLength(2);
		expect(result[0].name).toBe('London');
		expect(result[0].country).toBe('GB');
		expect(result[1].country).toBe('CA');
		expect(backendClient.GET).toHaveBeenCalled();
	});

	it('should set isSearching during search', async () => {
		let resolvePromise: (value: unknown) => void;
		const pendingPromise = new Promise((resolve) => {
			resolvePromise = resolve;
		});

		(backendClient.GET as Mock).mockReturnValue(pendingPromise);

		const { searchCities, isSearching } = useGeolocation();

		expect(isSearching.value).toBe(false);

		const searchPromise = searchCities('London');

		expect(isSearching.value).toBe(true);

		resolvePromise!({
			data: { data: mockCitiesResponse },
			response: { ok: true, status: 200 },
		});

		await searchPromise;

		expect(isSearching.value).toBe(false);
	});

	it('should return empty array on API error', async () => {
		(backendClient.GET as Mock).mockRejectedValue(new Error('Network error'));

		const { searchCities, isSearching } = useGeolocation();

		const result = await searchCities('London');

		expect(result).toEqual([]);
		expect(isSearching.value).toBe(false);
	});

	it('should return empty array on non-ok response', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: undefined,
			response: { ok: false, status: 500 },
		});

		const { searchCities } = useGeolocation();

		const result = await searchCities('London');

		expect(result).toEqual([]);
	});

	it('should handle response with no data', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: {},
			response: { ok: true, status: 200 },
		});

		const { searchCities } = useGeolocation();

		const result = await searchCities('London');

		expect(result).toEqual([]);
	});

	it('should include city details in response', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: mockCitiesResponse },
			response: { ok: true, status: 200 },
		});

		const { searchCities } = useGeolocation();

		const result = await searchCities('London');

		expect(result[0]).toEqual({
			name: 'London',
			lat: 51.5074,
			lon: -0.1278,
			country: 'GB',
			state: 'England',
			localNames: {
				en: 'London',
				de: 'London',
			},
		});
	});
});
