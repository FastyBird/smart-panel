/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Logger, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { OpenWeatherMapOneCallGeolocationService } from '../services/openweathermap-onecall-geolocation.service';

import { OpenWeatherMapOneCallGeolocationController } from './geolocation.controller';

describe('OpenWeatherMapOneCallGeolocationController', () => {
	let controller: OpenWeatherMapOneCallGeolocationController;
	let service: OpenWeatherMapOneCallGeolocationService;

	const mockCityResults = [
		{
			name: 'London',
			lat: 51.5074,
			lon: -0.1278,
			country: 'GB',
			state: 'England',
			localNames: {
				en: 'London',
				de: 'London',
			},
		},
		{
			name: 'London',
			lat: 42.9834,
			lon: -81.233,
			country: 'CA',
			state: 'Ontario',
		},
	];

	const mockZipResult = {
		name: 'New York',
		lat: 40.7128,
		lon: -74.006,
		country: 'US',
		zip: '10001',
	};

	const mockReverseGeoResults = [
		{
			name: 'London',
			lat: 51.5074,
			lon: -0.1278,
			country: 'GB',
			state: 'England',
		},
	];

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [OpenWeatherMapOneCallGeolocationController],
			providers: [
				{
					provide: OpenWeatherMapOneCallGeolocationService,
					useValue: {
						getCoordinatesByCity: jest.fn().mockResolvedValue(mockCityResults),
						getCoordinatesByZip: jest.fn().mockResolvedValue(mockZipResult),
						getCityByCoordinates: jest.fn().mockResolvedValue(mockReverseGeoResults),
					},
				},
			],
		}).compile();

		controller = module.get<OpenWeatherMapOneCallGeolocationController>(OpenWeatherMapOneCallGeolocationController);
		service = module.get<OpenWeatherMapOneCallGeolocationService>(OpenWeatherMapOneCallGeolocationService);

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

	describe('getCityCoordinates', () => {
		it('should return city coordinates', async () => {
			const result = await controller.getCityCoordinates('London');

			expect(result.data).toEqual(mockCityResults);
			expect(service.getCoordinatesByCity).toHaveBeenCalledWith('London');
		});

		it('should return empty array when no results found', async () => {
			jest.spyOn(service, 'getCoordinatesByCity').mockResolvedValue(null);

			const result = await controller.getCityCoordinates('UnknownCity');

			expect(result.data).toEqual([]);
		});
	});

	describe('getZipCoordinates', () => {
		it('should return zip coordinates', async () => {
			const result = await controller.getZipCoordinates('10001,US');

			expect(result.data).toEqual(mockZipResult);
			expect(service.getCoordinatesByZip).toHaveBeenCalledWith('10001,US');
		});

		it('should throw NotFoundException when zip not found', async () => {
			jest.spyOn(service, 'getCoordinatesByZip').mockResolvedValue(null);

			await expect(controller.getZipCoordinates('00000,XX')).rejects.toThrow(NotFoundException);
		});
	});

	describe('getCity', () => {
		it('should return city by coordinates', async () => {
			const result = await controller.getCity(51.5074, -0.1278);

			expect(result.data).toEqual(mockReverseGeoResults);
			expect(service.getCityByCoordinates).toHaveBeenCalledWith(51.5074, -0.1278);
		});

		it('should return empty array when no results found', async () => {
			jest.spyOn(service, 'getCityByCoordinates').mockResolvedValue(null);

			const result = await controller.getCity(0, 0);

			expect(result.data).toEqual([]);
		});
	});
});
