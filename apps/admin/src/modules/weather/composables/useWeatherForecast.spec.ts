import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IWeatherForecast } from '../store/weather-forecast.store.types';

import { useWeatherForecast } from './useWeatherForecast';

const mockWeatherForecast: IWeatherForecast = [
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

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useWeatherForecast', () => {
	let get: Mock;

	let mockStore: {
		get: Mock;
		$id: string;
		data: Ref;
		semaphore: Ref;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		get = vi.fn();

		mockStore = {
			get,
			$id: 'weatherForecast',
			data: ref(null),
			semaphore: ref({
				getting: false,
			}),
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('should return a weather forecast', () => {
		mockStore.data.value = mockWeatherForecast;

		const { weatherForecast } = useWeatherForecast();

		expect(weatherForecast.value).toEqual(mockWeatherForecast);
	});

	it('returns isLoading true if data is null and getting is true', () => {
		mockStore.semaphore.value.getting = true;

		const { isLoading } = useWeatherForecast();

		expect(isLoading.value).toBe(true);
	});

	it('returns isLoading false if data is present', () => {
		mockStore.semaphore.value.getting = false;

		const { isLoading } = useWeatherForecast();

		expect(isLoading.value).toBe(false);
	});

	it('calls fetchWeatherForecast and triggers store.get', async () => {
		const { fetchWeatherForecast } = useWeatherForecast();

		await fetchWeatherForecast();

		expect(get).toHaveBeenCalled();
	});
});
