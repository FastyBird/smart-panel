/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { v4 as uuid } from 'uuid';

import { HttpException, HttpStatus, Logger, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { WeatherService } from '../services/weather.service';
import { WeatherNotFoundException, WeatherNotSupportedException } from '../weather.exceptions';

import { WeatherController } from './weather.controller';

describe('WeatherController', () => {
	let controller: WeatherController;
	let service: WeatherService;

	const mockLocationId = uuid().toString();

	const mockCurrentWeather = {
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
		rain: null,
		snow: null,
		sunrise: new Date('2025-02-06T06:45:00Z'),
		sunset: new Date('2025-02-06T17:30:00Z'),
		dayTime: new Date('2025-02-06T12:00:00Z'),
	};

	const mockForecast = [
		{
			...mockCurrentWeather,
			dayTime: new Date('2025-02-07T12:00:00Z'),
		},
	];

	const mockWeatherData = {
		location: { id: mockLocationId, name: 'Test Location' },
		current: mockCurrentWeather,
		forecast: mockForecast,
	};

	const mockAllWeatherData = [
		{
			location_id: mockLocationId,
			location: { name: 'Test Location', country: 'US' },
			current: mockCurrentWeather,
		},
	];

	const mockAlerts = [
		{
			senderName: 'NWS',
			event: 'Wind Advisory',
			start: new Date('2025-02-06T10:00:00Z'),
			end: new Date('2025-02-06T22:00:00Z'),
			description: 'Expect strong winds',
			tags: ['Wind'],
		},
	];

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [WeatherController],
			providers: [
				{
					provide: WeatherService,
					useValue: {
						getAllWeather: jest.fn().mockResolvedValue(mockAllWeatherData),
						getPrimaryWeather: jest.fn().mockResolvedValue(mockWeatherData),
						getWeather: jest.fn().mockResolvedValue(mockWeatherData),
						getCurrentWeather: jest.fn().mockResolvedValue(mockCurrentWeather),
						getForecastWeather: jest.fn().mockResolvedValue(mockForecast),
						getAlerts: jest.fn().mockResolvedValue(mockAlerts),
					},
				},
			],
		}).compile();

		controller = module.get<WeatherController>(WeatherController);
		service = module.get<WeatherService>(WeatherService);

		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.resetAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(service).toBeDefined();
	});

	describe('getAllWeather', () => {
		it('should return weather data for all locations', async () => {
			const result = await controller.getAllWeather();

			expect(result.data).toEqual(mockAllWeatherData);
			expect(service.getAllWeather).toHaveBeenCalled();
		});
	});

	describe('getPrimaryWeather', () => {
		it('should return weather data for primary location', async () => {
			const result = await controller.getPrimaryWeather();

			expect(result.data).toEqual(mockWeatherData);
			expect(service.getPrimaryWeather).toHaveBeenCalled();
		});

		it('should throw NotFoundException when no primary location configured', async () => {
			jest
				.spyOn(service, 'getPrimaryWeather')
				.mockRejectedValue(new WeatherNotFoundException('No primary location configured'));

			await expect(controller.getPrimaryWeather()).rejects.toThrow(NotFoundException);
		});
	});

	describe('getWeather', () => {
		it('should return weather data for specific location', async () => {
			const result = await controller.getWeather(mockLocationId);

			expect(result.data).toEqual(mockWeatherData);
			expect(service.getWeather).toHaveBeenCalledWith(mockLocationId);
		});

		it('should throw NotFoundException when location not found', async () => {
			jest.spyOn(service, 'getWeather').mockRejectedValue(new WeatherNotFoundException('Location not found'));

			await expect(controller.getWeather('non-existent-id')).rejects.toThrow(NotFoundException);
		});
	});

	describe('getCurrentWeather', () => {
		it('should return current weather for specific location', async () => {
			const result = await controller.getCurrentWeather(mockLocationId);

			expect(result.data).toEqual(mockCurrentWeather);
			expect(service.getCurrentWeather).toHaveBeenCalledWith(mockLocationId);
		});

		it('should throw NotFoundException when location not found', async () => {
			jest.spyOn(service, 'getCurrentWeather').mockRejectedValue(new WeatherNotFoundException('Location not found'));

			await expect(controller.getCurrentWeather('non-existent-id')).rejects.toThrow(NotFoundException);
		});
	});

	describe('getForecastWeather', () => {
		it('should return forecast weather for specific location', async () => {
			const result = await controller.getForecastWeather(mockLocationId);

			expect(result.data).toEqual(mockForecast);
			expect(service.getForecastWeather).toHaveBeenCalledWith(mockLocationId);
		});

		it('should throw NotFoundException when location not found', async () => {
			jest.spyOn(service, 'getForecastWeather').mockRejectedValue(new WeatherNotFoundException('Location not found'));

			await expect(controller.getForecastWeather('non-existent-id')).rejects.toThrow(NotFoundException);
		});
	});

	describe('getAlerts', () => {
		it('should return weather alerts for specific location', async () => {
			const result = await controller.getAlerts(mockLocationId);

			expect(result.data).toEqual(mockAlerts);
			expect(service.getAlerts).toHaveBeenCalledWith(mockLocationId);
		});

		it('should throw NotFoundException when location not found', async () => {
			jest.spyOn(service, 'getAlerts').mockRejectedValue(new WeatherNotFoundException('Location not found'));

			await expect(controller.getAlerts('non-existent-id')).rejects.toThrow(NotFoundException);
		});

		it('should throw HttpException with NOT_IMPLEMENTED when alerts not supported', async () => {
			jest
				.spyOn(service, 'getAlerts')
				.mockRejectedValue(new WeatherNotSupportedException('Alerts not supported by provider'));

			await expect(controller.getAlerts(mockLocationId)).rejects.toThrow(HttpException);

			try {
				await controller.getAlerts(mockLocationId);
			} catch (error) {
				expect(error).toBeInstanceOf(HttpException);
				expect((error as HttpException).getStatus()).toBe(HttpStatus.NOT_IMPLEMENTED);
			}
		});
	});
});
