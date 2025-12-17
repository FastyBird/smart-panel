import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { WeatherApiException } from '../weather.exceptions';

import { useLocationWeather } from './useLocationWeather';

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

const mockTransformedWeatherDay = {
	temperature: 22.5,
	temperatureMin: 18.2,
	temperatureMax: 25.8,
	feelsLike: 21.9,
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
	sunrise: new Date('2025-02-06T06:45:00Z'),
	sunset: new Date('2025-02-06T17:30:00Z'),
	dayTime: new Date('2025-02-06T12:00:00Z'),
};

const mockForecastRes = [
	{
		temperature: 20.5,
		temperature_min: 16.2,
		temperature_max: 23.8,
		feels_like: 19.9,
		pressure: 1015,
		humidity: 60,
		weather: {
			code: 801,
			main: 'Clouds',
			description: 'few clouds',
			icon: '02d',
		},
		wind: {
			speed: 2.5,
			deg: 200,
			gust: 4.0,
		},
		clouds: 25,
		rain: 0,
		snow: 0,
		sunrise: '2025-02-07T06:44:00Z',
		sunset: '2025-02-07T17:31:00Z',
		day_time: '2025-02-07T12:00:00Z',
	},
];

const mockTransformedForecast = [
	{
		temperature: 20.5,
		temperatureMin: 16.2,
		temperatureMax: 23.8,
		feelsLike: 19.9,
		pressure: 1015,
		humidity: 60,
		weather: {
			code: 801,
			main: 'Clouds',
			description: 'few clouds',
			icon: '02d',
		},
		wind: {
			speed: 2.5,
			deg: 200,
			gust: 4.0,
		},
		clouds: 25,
		rain: 0,
		snow: 0,
		sunrise: new Date('2025-02-07T06:44:00Z'),
		sunset: new Date('2025-02-07T17:31:00Z'),
		dayTime: new Date('2025-02-07T12:00:00Z'),
	},
];

const backendClient = {
	GET: vi.fn(),
};

vi.mock('../store/weather-day.transformers', () => ({
	transformWeatherDayResponse: vi.fn(() => mockTransformedWeatherDay),
}));

vi.mock('../store/weather-forecast.transformers', () => ({
	transformWeatherForecastResponse: vi.fn(() => mockTransformedForecast),
}));

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

describe('useLocationWeather', () => {
	beforeEach(() => {
		setActivePinia(createPinia());

		vi.clearAllMocks();
	});

	it('should return initial state', () => {
		const { weather, isLoading, hasError } = useLocationWeather();

		expect(weather.value).toBeNull();
		expect(isLoading.value).toBe(false);
		expect(hasError.value).toBe(false);
	});

	it('should fetch location weather successfully', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: {
				data: {
					current: mockWeatherDayRes,
					forecast: mockForecastRes,
				},
			},
			error: undefined,
			response: { status: 200 },
		});

		const { weather, isLoading, hasError, fetchLocationWeather } = useLocationWeather();

		await fetchLocationWeather('123e4567-e89b-12d3-a456-426614174000');

		expect(weather.value).not.toBeNull();
		expect(weather.value?.current).toBeDefined();
		expect(weather.value?.forecast).toBeDefined();
		expect(isLoading.value).toBe(false);
		expect(hasError.value).toBe(false);
	});

	it('should set hasError on API failure', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: undefined,
			error: { message: 'Network error' },
			response: { status: 500 },
		});

		const { weather, hasError, fetchLocationWeather } = useLocationWeather();

		await expect(fetchLocationWeather('123e4567-e89b-12d3-a456-426614174000')).rejects.toThrow(WeatherApiException);

		expect(weather.value).toBeNull();
		expect(hasError.value).toBe(true);
	});

	it('should set isLoading during fetch', async () => {
		let resolvePromise: (value: unknown) => void;
		const pendingPromise = new Promise((resolve) => {
			resolvePromise = resolve;
		});

		(backendClient.GET as Mock).mockReturnValue(pendingPromise);

		const { isLoading, fetchLocationWeather } = useLocationWeather();

		expect(isLoading.value).toBe(false);

		const fetchPromise = fetchLocationWeather('123e4567-e89b-12d3-a456-426614174000');

		expect(isLoading.value).toBe(true);

		resolvePromise!({
			data: {
				data: {
					current: mockWeatherDayRes,
					forecast: mockForecastRes,
				},
			},
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

		const { fetchLocationWeather } = useLocationWeather();

		const promise1 = fetchLocationWeather('123e4567-e89b-12d3-a456-426614174000');
		const promise2 = fetchLocationWeather('123e4567-e89b-12d3-a456-426614174000');

		resolvePromise!({
			data: {
				data: {
					current: mockWeatherDayRes,
					forecast: mockForecastRes,
				},
			},
			error: undefined,
			response: { status: 200 },
		});

		await Promise.all([promise1, promise2]);

		expect(backendClient.GET).toHaveBeenCalledTimes(1);
	});

	it('should throw error when response is missing data', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: {} },
			error: undefined,
			response: { status: 200 },
		});

		const { hasError, fetchLocationWeather } = useLocationWeather();

		await expect(fetchLocationWeather('123e4567-e89b-12d3-a456-426614174000')).rejects.toThrow(WeatherApiException);

		expect(hasError.value).toBe(true);
	});
});
