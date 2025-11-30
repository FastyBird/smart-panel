import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigModuleWeatherCityNameLocationType, ConfigModuleWeatherType, ConfigModuleWeatherUnit } from '../../../openapi.constants';
import { ConfigApiException, ConfigValidationException } from '../config.exceptions';

import { useConfigWeather } from './config-weather.store';
import type { IConfigWeatherEditActionPayload, IConfigWeatherSetActionPayload } from './config-weather.store.types';

const mockWeatherRes = {
	type: ConfigModuleWeatherType.weather,
	cityName: 'Prague,CZ',
	locationType: ConfigModuleWeatherCityNameLocationType.city_name,
	unit: ConfigModuleWeatherUnit.celsius,
	open_weather_api_key: null,
};

const mockWeather = {
	type: ConfigModuleWeatherType.weather,
	cityName: 'Prague,CZ',
	locationType: ConfigModuleWeatherCityNameLocationType.city_name,
	unit: ConfigModuleWeatherUnit.celsius,
	openWeatherApiKey: null,
};

const backendClient = {
	GET: vi.fn(),
	PATCH: vi.fn(),
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

describe('ConfigWeather Store', () => {
	let store: ReturnType<typeof useConfigWeather>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useConfigWeather();

		vi.clearAllMocks();
	});

	it('should set config weather data successfully', () => {
		const result = store.set({ data: mockWeather });

		expect(result).toEqual(mockWeather);
		expect(store.data).toEqual(mockWeather);
	});

	it('should throw validation error if set config weather with invalid data', () => {
		expect(() => store.set({ data: { ...mockWeather, unit: 'invalid' } } as unknown as IConfigWeatherSetActionPayload)).toThrow(
			ConfigValidationException
		);
	});

	it('should fetch config weather successfully', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: mockWeatherRes },
			error: undefined,
			response: { status: 200 },
		});

		const result = await store.get();

		expect(result).toEqual(mockWeather);
		expect(store.data).toEqual(mockWeather);
	});

	it('should throw error if fetch fails', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: undefined,
			error: new Error('Network error'),
			response: { status: 500 },
		});

		await expect(store.get()).rejects.toThrow(ConfigApiException);
	});

	it('should update config weather successfully', async () => {
		store.data = { ...mockWeather };

		(backendClient.PATCH as Mock).mockResolvedValue({
			data: { data: { ...mockWeatherRes, unit: ConfigModuleWeatherUnit.fahrenheit } },
			error: undefined,
			response: { status: 200 },
		});

		const result = await store.edit({
			data: { ...mockWeather, unit: ConfigModuleWeatherUnit.fahrenheit },
		});

		expect(result.unit).toBe(ConfigModuleWeatherUnit.fahrenheit);
		expect(store.data?.unit).toBe(ConfigModuleWeatherUnit.fahrenheit);
	});

	it('should throw validation error if edit payload is invalid', async () => {
		await expect(
			store.edit({
				data: { ...mockWeather, unit: 'not-a-enum' },
			} as unknown as IConfigWeatherEditActionPayload)
		).rejects.toThrow(ConfigValidationException);
	});

	it('should throw validation error if local data + edit is invalid', async () => {
		store.data = { ...mockWeather, unit: ConfigModuleWeatherUnit.fahrenheit };

		await expect(
			store.edit({
				data: { ...mockWeather, unit: undefined },
			} as unknown as IConfigWeatherEditActionPayload)
		).rejects.toThrow(ConfigValidationException);
	});

	it('should refresh data and throw if API update fails', async () => {
		store.data = { ...mockWeather };

		(backendClient.PATCH as Mock).mockResolvedValue({
			data: undefined,
			error: new Error('Patch error'),
			response: { status: 500 },
		});

		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: mockWeatherRes },
			error: undefined,
			response: { status: 200 },
		});

		await expect(store.edit({ data: { ...mockWeather, unit: ConfigModuleWeatherUnit.fahrenheit } })).rejects.toThrow(ConfigApiException);
	});
});
