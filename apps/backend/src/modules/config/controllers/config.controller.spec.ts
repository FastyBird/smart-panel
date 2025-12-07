/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { BadRequestException, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import {
	LanguageType,
	LogLevelType,
	SectionType,
	TemperatureUnitType,
	TimeFormatType,
	WeatherLocationType,
} from '../config.constants';
import {
	UpdateAudioConfigDto,
	UpdateLanguageConfigDto,
	UpdateWeatherCityIdConfigDto,
	UpdateWeatherCityNameConfigDto,
	UpdateWeatherLatLonConfigDto,
	UpdateWeatherZipCodeConfigDto,
} from '../dto/config.dto';
import {
	AppConfigModel,
	AudioConfigModel,
	LanguageConfigModel,
	WeatherCityIdConfigModel,
	WeatherCityNameConfigModel,
	WeatherLatLonConfigModel,
	WeatherZipCodeConfigModel,
} from '../models/config.model';
import { ConfigService } from '../services/config.service';
import { PluginsTypeMapperService } from '../services/plugins-type-mapper.service';

import { ConfigController } from './config.controller';

describe('ConfigController', () => {
	let controller: ConfigController;
	let configService: ConfigService;

	const mockConfig: AppConfigModel = {
		path: '/var/smart-panel/config.yml',
		audio: {
			type: SectionType.AUDIO,
			speaker: true,
			speakerVolume: 50,
			microphone: false,
			microphoneVolume: 30,
		},
		language: {
			type: SectionType.LANGUAGE,
			language: LanguageType.ENGLISH,
			timezone: 'America/New_York',
			timeFormat: TimeFormatType.HOUR_12,
		},
		weather: {
			type: SectionType.WEATHER,
			cityName: 'New York,US',
			latitude: 0,
			longitude: 0,
			locationType: WeatherLocationType.CITY_NAME,
			unit: TemperatureUnitType.CELSIUS,
			openWeatherApiKey: 'dummy-api-key',
		},
		system: {
			type: SectionType.SYSTEM,
			logLevels: [LogLevelType.ERROR],
		},
		plugins: [],
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [ConfigController],
			providers: [
				{
					provide: ConfigService,
					useValue: {
						getConfig: jest.fn().mockReturnValue(mockConfig),
						getConfigSection: jest.fn((key: keyof AppConfigModel) => mockConfig[key]),
						setConfigSection: jest.fn(),
					},
				},
				{
					provide: PluginsTypeMapperService,
					useValue: {
						getMapping: jest.fn(),
					},
				},
			],
		}).compile();

		controller = module.get<ConfigController>(ConfigController);
		configService = module.get<ConfigService>(ConfigService);

		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(configService).toBeDefined();
	});

	describe('getAllConfig', () => {
		it('should return the entire configuration', () => {
			const result = controller.getAllConfig();
			expect(result).toHaveProperty('data');
			expect(result.data).toEqual(mockConfig);
			expect(configService.getConfig).toHaveBeenCalled();
		});
	});

	describe('getConfigSection', () => {
		it('should return the audio configuration section', () => {
			const result = controller.getConfigSection(SectionType.AUDIO);
			expect(result).toHaveProperty('data');
			expect(result.data).toEqual(mockConfig.audio);
			expect(configService.getConfigSection).toHaveBeenCalledWith(SectionType.AUDIO, AudioConfigModel);
		});

		it('should throw BadRequestException for an invalid section', () => {
			expect(() => controller.getConfigSection('invalid' as keyof AppConfigModel)).toThrow(BadRequestException);
		});
	});

	describe('updateAudioConfig', () => {
		it('should update and return the audio configuration', async () => {
			const updateDto: UpdateAudioConfigDto = { type: SectionType.AUDIO, speaker: false, speaker_volume: 20 };
			const updatedConfig = { ...mockConfig.audio, speaker: false, speakerVolume: 20 };

			jest.spyOn(configService, 'getConfigSection').mockReturnValue(updatedConfig);

			const result = await controller.updateAudioConfig({ data: updateDto });

			expect(result).toHaveProperty('data');
			expect(result.data).toMatchObject({
				type: SectionType.AUDIO,
				speaker: false,
				speakerVolume: 20,
			});
			expect(configService.setConfigSection).toHaveBeenCalledWith('audio', updateDto, UpdateAudioConfigDto);
			expect(configService.getConfigSection).toHaveBeenCalledWith('audio', AudioConfigModel);
		});
	});

	describe('updateLanguageConfig', () => {
		it('should update and return the language configuration', async () => {
			const updateDto: UpdateLanguageConfigDto = {
				type: SectionType.LANGUAGE,
				language: LanguageType.CZECH,
				timezone: 'Europe/Prague',
			};
			const updatedConfig = { ...mockConfig.language, ...updateDto };

			jest.spyOn(configService, 'getConfigSection').mockReturnValue(updatedConfig);

			const result = await controller.updateLanguageConfig({ data: updateDto });

			expect(result).toHaveProperty('data');
			expect(result.data).toEqual(updatedConfig);
			expect(configService.setConfigSection).toHaveBeenCalledWith('language', updateDto, UpdateLanguageConfigDto);
			expect(configService.getConfigSection).toHaveBeenCalledWith('language', LanguageConfigModel);
		});
	});

	describe('updateWeatherConfig', () => {
		it('should update and return the weather configuration', async () => {
			const updateDto: UpdateWeatherCityNameConfigDto = {
				type: SectionType.WEATHER,
				location_type: WeatherLocationType.CITY_NAME,
				city_name: 'Paris,FR',
				unit: TemperatureUnitType.FAHRENHEIT,
			};
			const updatedConfig = { ...mockConfig.weather, cityName: 'Paris,FR', unit: TemperatureUnitType.FAHRENHEIT };

			jest.spyOn(configService, 'getConfigSection').mockReturnValue(updatedConfig);

			const result = await controller.updateWeatherConfig({ data: updateDto });

			expect(result).toHaveProperty('data');
			expect(result.data).toMatchObject({
				type: SectionType.WEATHER,
				locationType: WeatherLocationType.CITY_NAME,
			});
			expect(result.data).toHaveProperty('unit', TemperatureUnitType.FAHRENHEIT);
			expect(configService.setConfigSection).toHaveBeenCalledWith('weather', updateDto, [
				UpdateWeatherLatLonConfigDto,
				UpdateWeatherCityNameConfigDto,
				UpdateWeatherCityIdConfigDto,
				UpdateWeatherZipCodeConfigDto,
			]);
			expect(configService.getConfigSection).toHaveBeenCalledWith('weather', [
				WeatherLatLonConfigModel,
				WeatherCityNameConfigModel,
				WeatherCityIdConfigModel,
				WeatherZipCodeConfigModel,
			]);
		});
	});
});
