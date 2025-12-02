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
import { ConfigException } from '../config.exceptions';
import {
	UpdateAudioConfigDto,
	UpdateDisplayConfigDto,
	UpdateLanguageConfigDto,
	UpdateModuleConfigDto,
	UpdateWeatherCityIdConfigDto,
	UpdateWeatherCityNameConfigDto,
	UpdateWeatherLatLonConfigDto,
	UpdateWeatherZipCodeConfigDto,
} from '../dto/config.dto';
import {
	AppConfigModel,
	AudioConfigModel,
	DisplayConfigModel,
	LanguageConfigModel,
	ModuleConfigModel,
	WeatherCityIdConfigModel,
	WeatherCityNameConfigModel,
	WeatherLatLonConfigModel,
	WeatherZipCodeConfigModel,
} from '../models/config.model';
import { ConfigService } from '../services/config.service';
import { ModulesTypeMapperService } from '../services/modules-type-mapper.service';
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
		display: {
			type: SectionType.DISPLAY,
			darkMode: true,
			brightness: 80,
			screenLockDuration: 5,
			screenSaver: true,
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
		modules: [
			{
				type: 'mock-module',
				enabled: true,
			} as ModuleConfigModel,
		],
	};

	beforeEach(async () => {
		const testingModule: TestingModule = await Test.createTestingModule({
			controllers: [ConfigController],
			providers: [
				{
					provide: ConfigService,
					useValue: {
						getConfig: jest.fn().mockReturnValue(mockConfig),
						getConfigSection: jest.fn((key: keyof AppConfigModel) => mockConfig[key]),
						setConfigSection: jest.fn(),
						getModulesConfig: jest.fn().mockReturnValue(mockConfig.modules),
						getModuleConfig: jest.fn((_module: string) => mockConfig.modules[0]),
						setModuleConfig: jest.fn(),
					},
				},
				{
					provide: PluginsTypeMapperService,
					useValue: {
						getMapping: jest.fn(),
					},
				},
				{
					provide: ModulesTypeMapperService,
					useValue: {
						getMapping: jest.fn(() => ({
							type: 'mock-module',
							class: ModuleConfigModel,
							configDto: UpdateModuleConfigDto,
						})),
					},
				},
			],
		}).compile();

		controller = testingModule.get<ConfigController>(ConfigController);
		configService = testingModule.get<ConfigService>(ConfigService);

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

		it('should return the display configuration section', () => {
			const result = controller.getConfigSection(SectionType.DISPLAY);
			expect(result).toHaveProperty('data');
			expect(result.data).toEqual(mockConfig.display);
			expect(configService.getConfigSection).toHaveBeenCalledWith(SectionType.DISPLAY, DisplayConfigModel);
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

	describe('updateDisplayConfig', () => {
		it('should update and return the display configuration', async () => {
			const updateDto: UpdateDisplayConfigDto = { type: SectionType.DISPLAY, brightness: 60, dark_mode: false };
			const updatedConfig = { ...mockConfig.display, brightness: 60, darkMode: false };

			jest.spyOn(configService, 'getConfigSection').mockReturnValue(updatedConfig);

			const result = await controller.updateDisplayConfig({ data: updateDto });

			expect(result).toHaveProperty('data');
			expect(result.data).toMatchObject({
				type: SectionType.DISPLAY,
				brightness: 60,
				darkMode: false,
			});
			expect(configService.setConfigSection).toHaveBeenCalledWith('display', updateDto, UpdateDisplayConfigDto);
			expect(configService.getConfigSection).toHaveBeenCalledWith('display', DisplayConfigModel);
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

	describe('getModulesConfig', () => {
		it('should return all module configurations', () => {
			const mockModules = mockConfig.modules;
			jest.spyOn(configService, 'getModulesConfig').mockReturnValue(mockModules);

			const result = controller.getModulesConfig();

			expect(result).toHaveProperty('data');
			expect(result.data).toEqual(mockModules);
			expect(configService.getModulesConfig).toHaveBeenCalled();
		});
	});

	describe('getModuleConfig', () => {
		it('should return a specific module configuration', () => {
			const mockModule = mockConfig.modules[0];
			jest.spyOn(configService, 'getModuleConfig').mockReturnValue(mockModule);

			const result = controller.getModuleConfig('mock-module');

			expect(result).toHaveProperty('data');
			expect(result.data).toEqual(mockModule);
			expect(configService.getModuleConfig).toHaveBeenCalledWith('mock-module');
		});

		it('should throw ConfigNotFoundException for a non-existent module', () => {
			(configService.getModuleConfig as jest.Mock).mockImplementation(() => {
				throw new ConfigException("Configuration module 'non-existent' not found.");
			});

			expect(() => controller.getModuleConfig('non-existent')).toThrow();
			expect(configService.getModuleConfig).toHaveBeenCalledWith('non-existent');
		});
	});

	describe('updateModuleConfig', () => {
		it('should update and return the module configuration', async () => {
			const updateDto: UpdateModuleConfigDto = { type: 'mock-module', enabled: false };
			const updatedModule = { ...mockConfig.modules[0], enabled: false } as ModuleConfigModel;

			jest.spyOn(configService, 'getModuleConfig').mockReturnValue(updatedModule);
			jest.spyOn(configService, 'setModuleConfig').mockImplementation(() => {});

			const result = await controller.updateModuleConfig('mock-module', { data: updateDto });

			expect(result).toHaveProperty('data');
			expect(result.data).toMatchObject({
				type: 'mock-module',
				enabled: false,
			});
			expect(configService.setModuleConfig).toHaveBeenCalledWith('mock-module', updateDto);
			expect(configService.getModuleConfig).toHaveBeenCalledWith('mock-module');
		});

		it('should throw BadRequestException for an unsupported module type', async () => {
			const updateDto: UpdateModuleConfigDto = { type: 'unsupported-module', enabled: false };

			const modulesMapperService = controller['modulesMapperService'];
			jest.spyOn(modulesMapperService, 'getMapping').mockImplementation(() => {
				throw new ConfigException('Unsupported module type: unsupported-module');
			});

			await expect(controller.updateModuleConfig('unsupported-module', { data: updateDto })).rejects.toThrow(
				BadRequestException,
			);
		});
	});
});
