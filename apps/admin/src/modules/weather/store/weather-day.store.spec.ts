import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { WeatherApiException, WeatherValidationException } from '../weather.exceptions';

import { useWeatherDay } from './weather-day.store';
import type { IWeatherDaySetActionPayload } from './weather-day.store.types';

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
	rain: 10,
	snow: 10,
	sunrise: '2025-02-06T06:45:00Z',
	sunset: '2025-02-06T17:30:00Z',
	day_time: '2019-08-24T14:15:22Z',
};

const mockWeatherDay = {
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
	rain: 10,
	snow: 10,
	sunrise: new Date('2025-02-06T06:45:00Z'),
	sunset: new Date('2025-02-06T17:30:00Z'),
	dayTime: new Date('2019-08-24T14:15:22Z'),
};

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

describe('WeatherDay Store', () => {
	let store: ReturnType<typeof useWeatherDay>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useWeatherDay();

		vi.clearAllMocks();
	});

	it('should set weather day data successfully', () => {
		const result = store.set({ data: mockWeatherDay });

		expect(result).toEqual(mockWeatherDay);
		expect(store.data).toEqual(mockWeatherDay);
	});

	it('should throw validation error if set weather day with invalid data', () => {
		expect(() => store.set({ data: { ...mockWeatherDay, temperature: 'invalid' } } as unknown as IWeatherDaySetActionPayload)).toThrow(
			WeatherValidationException
		);
	});

	it('should fetch weather day successfully', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: { current: mockWeatherDayRes } },
			error: undefined,
			response: { status: 200 },
		});

		const result = await store.get();

		expect(result).toEqual(mockWeatherDay);
		expect(store.data).toEqual(mockWeatherDay);
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
