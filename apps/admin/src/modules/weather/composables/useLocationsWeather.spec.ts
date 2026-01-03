import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { WeatherApiException } from '../weather.exceptions';

import { useLocationsWeather } from './useLocationsWeather';

const mockWeatherDayRes = {
	temperature: 22.5,
	temperature_min: 18.2,
	temperature_max: 25.8,
	feels_like: 21.9,
	pressure: 1013,
	humidity: 55,
	weather: {
		code: 800,
		main: 'Clear',
		description: 'clear sky',
		icon: '01d',
	},
	wind: {
		speed: 3.5,
		deg: 180,
		gust: 5.8,
	},
	clouds: 10,
	rain: 0,
	snow: 0,
	sunrise: '2025-02-06T06:45:00Z',
	sunset: '2025-02-06T17:30:00Z',
	day_time: '2025-02-06T12:00:00Z',
};

const mockLocationsWeatherRes = [
	{
		location_id: '123e4567-e89b-12d3-a456-426614174000',
		current: mockWeatherDayRes,
		location: {
			name: 'Home',
			country: 'US',
		},
	},
	{
		location_id: '223e4567-e89b-12d3-a456-426614174001',
		current: {
			...mockWeatherDayRes,
			temperature: 20.0,
		},
		location: {
			name: 'Office',
			country: 'US',
		},
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
		useLogger: vi.fn(() => ({
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		})),
	};
});

describe('useLocationsWeather', () => {
	beforeEach(() => {
		setActivePinia(createPinia());

		vi.clearAllMocks();
	});

	it('should return initial state', () => {
		const { weatherByLocation, isLoading, hasError, fetchCompleted } = useLocationsWeather();

		expect(weatherByLocation.value).toEqual({});
		expect(isLoading.value).toBe(false);
		expect(hasError.value).toBe(false);
		expect(fetchCompleted.value).toBe(false);
	});

	it('should fetch all locations weather successfully', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: mockLocationsWeatherRes },
			error: undefined,
			response: { status: 200 },
		});

		const { weatherByLocation, isLoading, hasError, fetchCompleted, fetchLocationsWeather } = useLocationsWeather();

		await fetchLocationsWeather();

		expect(Object.keys(weatherByLocation.value)).toHaveLength(2);
		expect(weatherByLocation.value['123e4567-e89b-12d3-a456-426614174000']).toBeDefined();
		expect(weatherByLocation.value['223e4567-e89b-12d3-a456-426614174001']).toBeDefined();
		expect(weatherByLocation.value['123e4567-e89b-12d3-a456-426614174000']?.locationName).toBe('Home');
		expect(weatherByLocation.value['223e4567-e89b-12d3-a456-426614174001']?.locationName).toBe('Office');
		expect(isLoading.value).toBe(false);
		expect(hasError.value).toBe(false);
		expect(fetchCompleted.value).toBe(true);
	});

	it('should set hasError on API failure', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: undefined,
			error: { message: 'Network error' },
			response: { status: 500 },
		});

		const { weatherByLocation, hasError, fetchCompleted, fetchLocationsWeather } = useLocationsWeather();

		await expect(fetchLocationsWeather()).rejects.toThrow(WeatherApiException);

		expect(weatherByLocation.value).toEqual({});
		expect(hasError.value).toBe(true);
		expect(fetchCompleted.value).toBe(true);
	});

	it('should set hasError when response is empty', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: [] },
			error: undefined,
			response: { status: 200 },
		});

		const { weatherByLocation, hasError, fetchLocationsWeather } = useLocationsWeather();

		await fetchLocationsWeather();

		expect(weatherByLocation.value).toEqual({});
		expect(hasError.value).toBe(true);
	});

	it('should set isLoading during fetch', async () => {
		let resolvePromise: (value: unknown) => void;
		const pendingPromise = new Promise((resolve) => {
			resolvePromise = resolve;
		});

		(backendClient.GET as Mock).mockReturnValue(pendingPromise);

		const { isLoading, fetchLocationsWeather } = useLocationsWeather();

		expect(isLoading.value).toBe(false);

		const fetchPromise = fetchLocationsWeather();

		expect(isLoading.value).toBe(true);

		resolvePromise!({
			data: { data: mockLocationsWeatherRes },
			error: undefined,
			response: { status: 200 },
		});

		await fetchPromise;

		expect(isLoading.value).toBe(false);
	});

	it('should not make concurrent requests', async () => {
		let resolvePromise: (value: unknown) => void;
		const pendingPromise = new Promise((resolve) => {
			resolvePromise = resolve;
		});

		(backendClient.GET as Mock).mockReturnValue(pendingPromise);

		const { fetchLocationsWeather } = useLocationsWeather();

		const promise1 = fetchLocationsWeather();
		const promise2 = fetchLocationsWeather();

		resolvePromise!({
			data: { data: mockLocationsWeatherRes },
			error: undefined,
			response: { status: 200 },
		});

		await Promise.all([promise1, promise2]);

		expect(backendClient.GET).toHaveBeenCalledTimes(1);
	});

	it('should include country in location data', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: mockLocationsWeatherRes },
			error: undefined,
			response: { status: 200 },
		});

		const { weatherByLocation, fetchLocationsWeather } = useLocationsWeather();

		await fetchLocationsWeather();

		expect(weatherByLocation.value['123e4567-e89b-12d3-a456-426614174000']?.country).toBe('US');
	});

	it('should handle missing location data gracefully', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: {
				data: [
					{
						location_id: '123e4567-e89b-12d3-a456-426614174000',
						current: mockWeatherDayRes,
						// no location data
					},
				],
			},
			error: undefined,
			response: { status: 200 },
		});

		const { weatherByLocation, fetchLocationsWeather } = useLocationsWeather();

		await fetchLocationsWeather();

		expect(weatherByLocation.value['123e4567-e89b-12d3-a456-426614174000']?.locationName).toBe('');
		expect(weatherByLocation.value['123e4567-e89b-12d3-a456-426614174000']?.country).toBeNull();
	});
});
