/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import fetch from 'node-fetch';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../../modules/config/services/config.service';
import { OpenWeatherMapOneCallConfigModel } from '../models/config.model';
import { WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME } from '../weather-openweathermap-onecall.constants';

import { OpenWeatherMapOneCallGeolocationService } from './openweathermap-onecall-geolocation.service';

jest.mock('node-fetch');

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('OpenWeatherMapOneCallGeolocationService', () => {
	let service: OpenWeatherMapOneCallGeolocationService;
	let configService: ConfigService;

	const mockConfig: OpenWeatherMapOneCallConfigModel = {
		type: WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME,
		apiKey: 'test-api-key',
	} as OpenWeatherMapOneCallConfigModel;

	const mockCityApiResponse = [
		{
			name: 'London',
			local_names: {
				en: 'London',
				de: 'London',
			},
			lat: 51.5074,
			lon: -0.1278,
			country: 'GB',
			state: 'England',
		},
	];

	const mockZipApiResponse = {
		zip: '10001',
		name: 'New York',
		lat: 40.7128,
		lon: -74.006,
		country: 'US',
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				OpenWeatherMapOneCallGeolocationService,
				{
					provide: ConfigService,
					useValue: {
						getPluginConfig: jest.fn().mockReturnValue(mockConfig),
					},
				},
			],
		}).compile();

		service = module.get<OpenWeatherMapOneCallGeolocationService>(OpenWeatherMapOneCallGeolocationService);
		configService = module.get<ConfigService>(ConfigService);

	});

	afterEach(() => {
		jest.resetAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('getCoordinatesByCity', () => {
		it('should return city coordinates', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue(mockCityApiResponse),
			} as any);

			const result = await service.getCoordinatesByCity('London');

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe('London');
			expect(result[0].lat).toBe(51.5074);
			expect(result[0].lon).toBe(-0.1278);
			expect(result[0].country).toBe('GB');
		});

		it('should return null when API key is missing', async () => {
			jest.spyOn(configService, 'getPluginConfig').mockImplementation(() => {
				throw new Error('Config not found');
			});

			const result = await service.getCoordinatesByCity('London');

			expect(result).toBeNull();
		});

		it('should return null when response is empty', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue([]),
			} as any);

			const result = await service.getCoordinatesByCity('UnknownCity');

			expect(result).toBeNull();
		});

		it('should return null when response is invalid', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({ invalid: 'response' }),
			} as any);

			const result = await service.getCoordinatesByCity('London');

			expect(result).toBeNull();
		});

		it('should return null on fetch error', async () => {
			mockFetch.mockRejectedValue(new Error('Network error'));

			const result = await service.getCoordinatesByCity('London');

			expect(result).toBeNull();
		});
	});

	describe('getCoordinatesByZip', () => {
		it('should return zip coordinates', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue(mockZipApiResponse),
			} as any);

			const result = await service.getCoordinatesByZip('10001,US');

			expect(result).not.toBeNull();
			expect(result.name).toBe('New York');
			expect(result.lat).toBe(40.7128);
			expect(result.lon).toBe(-74.006);
			expect(result.country).toBe('US');
		});

		it('should return null when API key is missing', async () => {
			jest.spyOn(configService, 'getPluginConfig').mockImplementation(() => {
				throw new Error('Config not found');
			});

			const result = await service.getCoordinatesByZip('10001,US');

			expect(result).toBeNull();
		});

		it('should return null when response is not ok', async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				json: jest.fn().mockResolvedValue({}),
			} as any);

			const result = await service.getCoordinatesByZip('00000,XX');

			expect(result).toBeNull();
		});

		it('should return null on fetch error', async () => {
			mockFetch.mockRejectedValue(new Error('Network error'));

			const result = await service.getCoordinatesByZip('10001,US');

			expect(result).toBeNull();
		});
	});

	describe('getCityByCoordinates', () => {
		it('should return city by coordinates', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue(mockCityApiResponse),
			} as any);

			const result = await service.getCityByCoordinates(51.5074, -0.1278);

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe('London');
			expect(result[0].country).toBe('GB');
		});

		it('should return null when API key is missing', async () => {
			jest.spyOn(configService, 'getPluginConfig').mockImplementation(() => {
				throw new Error('Config not found');
			});

			const result = await service.getCityByCoordinates(51.5074, -0.1278);

			expect(result).toBeNull();
		});

		it('should return null when response is empty', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue([]),
			} as any);

			const result = await service.getCityByCoordinates(0, 0);

			expect(result).toBeNull();
		});

		it('should return null when response is invalid', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({ invalid: 'response' }),
			} as any);

			const result = await service.getCityByCoordinates(51.5074, -0.1278);

			expect(result).toBeNull();
		});

		it('should return null on fetch error', async () => {
			mockFetch.mockRejectedValue(new Error('Network error'));

			const result = await service.getCityByCoordinates(51.5074, -0.1278);

			expect(result).toBeNull();
		});
	});
});
