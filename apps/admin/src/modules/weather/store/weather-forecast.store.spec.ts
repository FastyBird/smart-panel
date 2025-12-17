import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { WeatherApiException, WeatherValidationException } from '../weather.exceptions';

import { useWeatherForecast } from './weather-forecast.store';
import type { IWeatherForecastSetActionPayload } from './weather-forecast.store.types';

const mockWeatherForecastDayRes = {
	temperature: {
		morn: 22.5,
		day: 24.5,
		eve: 22.5,
		night: 20.5,
		min: 20.5,
		max: 24.5,
	},
	feels_like: {
		morn: 22.5,
		day: 24.5,
		eve: 22.5,
		night: 20.5,
	},
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
	rain: 10,
	snow: 10,
	sunrise: '2025-02-06T06:45:00Z',
	sunset: '2025-02-06T17:30:00Z',
	moonrise: '2025-02-06T17:30:00Z',
	moonset: '2025-02-06T17:30:00Z',
	day_time: '2019-08-24T14:15:22Z',
};

const mockWeatherForecast = [
	{
		temperature: {
			morn: 22.5,
			day: 24.5,
			eve: 22.5,
			night: 20.5,
			min: 20.5,
			max: 24.5,
		},
		feelsLike: {
			morn: 22.5,
			day: 24.5,
			eve: 22.5,
			night: 20.5,
		},
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
		rain: 10,
		snow: 10,
		sunrise: new Date('2025-02-06T06:45:00Z'),
		sunset: new Date('2025-02-06T17:30:00Z'),
		moonrise: new Date('2025-02-06T17:30:00Z'),
		moonset: new Date('2025-02-06T17:30:00Z'),
		dayTime: new Date('2019-08-24T14:15:22Z'),
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
		getErrorReason: () => 'Some error',
	};
});

describe('WeatherForecast Store', () => {
	let store: ReturnType<typeof useWeatherForecast>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useWeatherForecast();

		vi.clearAllMocks();
	});

	it('should set weather day data successfully', () => {
		const result = store.set({ data: mockWeatherForecast });

		expect(result).toEqual(mockWeatherForecast);
		expect(store.data).toEqual(mockWeatherForecast);
	});

	it('should throw validation error if set weather day with invalid data', () => {
		expect(() => store.set({ data: { ...mockWeatherForecast, temperature: 'invalid' } } as unknown as IWeatherForecastSetActionPayload)).toThrow(
			WeatherValidationException
		);
	});

	it('should fetch weather day successfully', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: { forecast: [mockWeatherForecastDayRes] } },
			error: undefined,
			response: { status: 200 },
		});

		const result = await store.get();

		expect(result).toEqual(mockWeatherForecast);
		expect(store.data).toEqual(mockWeatherForecast);
	});

	it('should throw error if fetch fails', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: undefined,
			error: new Error('Network error'),
			response: { status: 500 },
		});

		await expect(store.get()).rejects.toThrow(WeatherApiException);
	});
});
