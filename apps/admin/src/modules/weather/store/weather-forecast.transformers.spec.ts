import { describe, expect, it, vi } from 'vitest';

import { WeatherValidationException } from '../weather.exceptions';

import type { IWeatherForecastDayRes } from './weather-forecast.store.types';
import { transformWeatherForecastResponse } from './weather-forecast.transformers';

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

const validWeatherForecastResponse: IWeatherForecastDayRes = {
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

describe('WeatherForecast Transformers', (): void => {
	describe('transformWeatherForecastResponse', (): void => {
		it('should transform a valid weather day response', (): void => {
			const result = transformWeatherForecastResponse([validWeatherForecastResponse]);

			expect(result).toEqual([
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
			]);
		});

		it('should throw an error for an invalid weather day response', (): void => {
			expect(() =>
				transformWeatherForecastResponse([
					{
						...validWeatherForecastResponse,
						humidity: 'not-a-number',
					} as unknown as IWeatherForecastDayRes,
				])
			).toThrow(WeatherValidationException);
		});
	});
});
