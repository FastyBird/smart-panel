/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Cache } from 'cache-manager';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../config/services/config.service';
import { WeatherLocationEntity } from '../entities/locations.entity';
import { WeatherConfigModel } from '../models/config.model';
import { WEATHER_MODULE_NAME } from '../weather.constants';
import { WeatherNotFoundException } from '../weather.exceptions';

import { LocationsService } from './locations.service';
import { WeatherProviderRegistryService } from './weather-provider-registry.service';
import { WeatherService } from './weather.service';

describe('WeatherService', () => {
	let service: WeatherService;
	let locationsService: LocationsService;
	let configService: ConfigService;
	let eventEmitter: EventEmitter2;
	let cacheManager: Cache;

	const mockLocation: WeatherLocationEntity = {
		id: '550e8400-e29b-41d4-a716-446655440000',
		name: 'Test Location',
		type: 'weather-openweathermap',
		createdAt: new Date(),
		updatedAt: new Date(),
	} as WeatherLocationEntity;

	const mockWeatherConfig: WeatherConfigModel = {
		type: WEATHER_MODULE_NAME,
		primaryLocationId: '550e8400-e29b-41d4-a716-446655440000',
	} as WeatherConfigModel;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				WeatherService,
				{
					provide: SchedulerRegistry,
					useValue: {
						addCronJob: jest.fn(),
						deleteCronJob: jest.fn(),
					},
				},
				{
					provide: LocationsService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([mockLocation]),
						findOne: jest.fn().mockResolvedValue(mockLocation),
					},
				},
				{
					provide: WeatherProviderRegistryService,
					useValue: {
						getProvider: jest.fn().mockReturnValue(null),
					},
				},
				{
					provide: ConfigService,
					useValue: {
						getModuleConfig: jest.fn().mockReturnValue(mockWeatherConfig),
					},
				},
				{
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(),
					},
				},
				{
					provide: CACHE_MANAGER,
					useValue: {
						get: jest.fn().mockResolvedValue(null),
						set: jest.fn().mockResolvedValue(undefined),
						del: jest.fn().mockResolvedValue(undefined),
					},
				},
			],
		}).compile();

		service = module.get<WeatherService>(WeatherService);
		locationsService = module.get<LocationsService>(LocationsService);
		configService = module.get<ConfigService>(ConfigService);
		eventEmitter = module.get<EventEmitter2>(EventEmitter2);
		cacheManager = module.get<Cache>(CACHE_MANAGER);

		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.resetAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('getPrimaryLocationId', () => {
		it('should return the primary location ID from config', () => {
			const result = service.getPrimaryLocationId();

			expect(result).toBe('550e8400-e29b-41d4-a716-446655440000');
			expect(configService.getModuleConfig).toHaveBeenCalledWith(WEATHER_MODULE_NAME);
		});

		it('should return null when no primary location is configured', () => {
			jest.spyOn(configService, 'getModuleConfig').mockReturnValue({
				type: WEATHER_MODULE_NAME,
				primaryLocationId: null,
			} as WeatherConfigModel);

			const result = service.getPrimaryLocationId();

			expect(result).toBeNull();
		});

		it('should return null when config service throws', () => {
			jest.spyOn(configService, 'getModuleConfig').mockImplementation(() => {
				throw new Error('Config not found');
			});

			const result = service.getPrimaryLocationId();

			expect(result).toBeNull();
		});
	});

	describe('getPrimaryWeather', () => {
		it('should throw WeatherNotFoundException when no primary location is configured', async () => {
			jest.spyOn(configService, 'getModuleConfig').mockReturnValue({
				type: WEATHER_MODULE_NAME,
				primaryLocationId: null,
			} as WeatherConfigModel);

			await expect(service.getPrimaryWeather()).rejects.toThrow(WeatherNotFoundException);
			await expect(service.getPrimaryWeather()).rejects.toThrow('No primary location configured');
		});

		it('should call getWeather with primary location ID', async () => {
			const getWeatherSpy = jest.spyOn(service, 'getWeather').mockResolvedValue({
				location: { id: mockLocation.id, name: mockLocation.name },
				current: null,
				forecast: [],
			} as any);

			await service.getPrimaryWeather();

			expect(getWeatherSpy).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000', false);
		});
	});

	describe('getWeather', () => {
		it('should throw WeatherNotFoundException when location not found', async () => {
			jest.spyOn(locationsService, 'findOne').mockResolvedValue(null);

			await expect(service.getWeather('non-existent-id')).rejects.toThrow(WeatherNotFoundException);
		});

		it('should return cached weather data when available', async () => {
			const cachedCurrent = { temperature: 20 };
			const cachedForecast = [{ dayTime: new Date() }];

			jest.spyOn(cacheManager, 'get')
				.mockResolvedValueOnce(cachedCurrent)
				.mockResolvedValueOnce(cachedForecast);

			const result = await service.getWeather(mockLocation.id);

			expect(result.location.id).toBe(mockLocation.id);
			expect(result.current).toEqual(cachedCurrent);
			expect(result.forecast).toEqual(cachedForecast);
		});
	});

	describe('getAllWeather', () => {
		it('should return weather for all locations', async () => {
			const getWeatherSpy = jest.spyOn(service, 'getWeather').mockResolvedValue({
				location: { id: mockLocation.id, name: mockLocation.name },
				current: null,
				forecast: [],
			} as any);

			const result = await service.getAllWeather();

			expect(result).toHaveLength(1);
			expect(getWeatherSpy).toHaveBeenCalledWith(mockLocation.id, false);
		});

		it('should handle errors for individual locations gracefully', async () => {
			jest.spyOn(service, 'getWeather').mockRejectedValue(new Error('Provider error'));

			const result = await service.getAllWeather();

			// Should return empty array when all locations fail
			expect(result).toHaveLength(0);
		});
	});
});
