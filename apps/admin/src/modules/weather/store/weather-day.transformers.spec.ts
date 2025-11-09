import { describe, expect, it, vi } from 'vitest';

import { WeatherValidationException } from '../weather.exceptions';

import type { IWeatherDayRes } from './weather-day.store.types';
import { transformWeatherDayResponse } from './weather-day.transformers';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		logger: {
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
		},
	};
});

const validWeatherDayResponse: IWeatherDayRes = {
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

describe('WeatherDay Transformers', (): void => {
	describe('transformWeatherDayResponse', (): void => {
		it('should transform a valid weather day response', (): void => {
			const result = transformWeatherDayResponse(validWeatherDayResponse);

			expect(result).toEqual({
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
			});
		});

		it('should throw an error for an invalid weather day response', (): void => {
			expect(() =>
				transformWeatherDayResponse({
					...validWeatherDayResponse,
					temperature: 'not-a-number',
				} as unknown as IWeatherDayRes)
			).toThrow(WeatherValidationException);
		});
	});
});
