import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IWeatherDay } from '../store/weather-day.store.types';

import { useWeatherDay } from './useWeatherDay';

const mockWeatherDay: IWeatherDay = {
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

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useWeatherDay', () => {
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
			$id: 'weatherDay',
			data: ref(null),
			semaphore: ref({
				getting: false,
			}),
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('should return a weather day', () => {
		mockStore.data.value = mockWeatherDay;

		const { weatherDay } = useWeatherDay();

		expect(weatherDay.value).toEqual(mockWeatherDay);
	});

	it('returns isLoading true if data is null and getting is true', () => {
		mockStore.semaphore.value.getting = true;

		const { isLoading } = useWeatherDay();

		expect(isLoading.value).toBe(true);
	});

	it('returns isLoading false if data is present', () => {
		mockStore.semaphore.value.getting = false;

		const { isLoading } = useWeatherDay();

		expect(isLoading.value).toBe(false);
	});

	it('calls fetchWeatherDay and triggers store.get', async () => {
		const { fetchWeatherDay } = useWeatherDay();

		await fetchWeatherDay();

		expect(get).toHaveBeenCalled();
	});
});
