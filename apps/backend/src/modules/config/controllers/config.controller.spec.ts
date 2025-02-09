/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { BadRequestException, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { LanguageEnum, TemperatureUnitEnum, TimeFormatEnum, WeatherLocationTypeEnum } from '../config.constants';
import {
	UpdateAudioConfigDto,
	UpdateDisplayConfigDto,
	UpdateLanguageConfigDto,
	UpdateWeatherConfigDto,
} from '../dto/config.dto';
import {
	AppConfigEntity,
	AudioConfigEntity,
	DisplayConfigEntity,
	LanguageConfigEntity,
	WeatherConfigEntity,
} from '../entities/config.entity';
import { ConfigService } from '../services/config.service';

import { ConfigController } from './config.controller';

describe('ConfigController', () => {
	let controller: ConfigController;
	let configService: ConfigService;

	const mockConfig: AppConfigEntity = {
		audio: {
			speaker: true,
			speakerVolume: 50,
			microphone: false,
			microphoneVolume: 30,
		},
		display: {
			darkMode: true,
			brightness: 80,
			screenLockDuration: 5,
			screenSaver: true,
		},
		language: {
			language: LanguageEnum.ENGLISH,
			timezone: 'America/New_York',
			timeFormat: TimeFormatEnum.HOUR_12,
		},
		weather: {
			location: 'New York',
			locationType: WeatherLocationTypeEnum.CITY_NAME,
			unit: TemperatureUnitEnum.CELSIUS,
			openWeatherApiKey: 'dummy-api-key',
		},
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [ConfigController],
			providers: [
				{
					provide: ConfigService,
					useValue: {
						getConfig: jest.fn().mockReturnValue(mockConfig),
						getConfigSection: jest.fn((key: keyof AppConfigEntity) => mockConfig[key]),
						setConfigSection: jest.fn(),
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

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(configService).toBeDefined();
	});

	describe('getAllConfig', () => {
		it('should return the entire configuration', () => {
			const result = controller.getAllConfig();
			expect(result).toEqual(mockConfig);
			expect(configService.getConfig).toHaveBeenCalled();
		});
	});

	describe('getConfigSection', () => {
		it('should return the audio configuration section', () => {
			const result = controller.getConfigSection('audio');
			expect(result).toEqual(mockConfig.audio);
			expect(configService.getConfigSection).toHaveBeenCalledWith('audio', AudioConfigEntity);
		});

		it('should return the display configuration section', () => {
			const result = controller.getConfigSection('display');
			expect(result).toEqual(mockConfig.display);
			expect(configService.getConfigSection).toHaveBeenCalledWith('display', DisplayConfigEntity);
		});

		it('should throw BadRequestException for an invalid section', () => {
			expect(() => controller.getConfigSection('invalid' as keyof AppConfigEntity)).toThrow(BadRequestException);
		});
	});

	describe('updateAudioConfig', () => {
		it('should update and return the audio configuration', async () => {
			const updateDto: UpdateAudioConfigDto = { speaker: false, speaker_volume: 20 };
			const updatedConfig = { ...mockConfig.audio, ...updateDto };

			jest.spyOn(configService, 'getConfigSection').mockReturnValue(updatedConfig);

			const result = await controller.updateAudioConfig(updateDto);

			expect(result).toEqual(updatedConfig);
			expect(configService.setConfigSection).toHaveBeenCalledWith('audio', updateDto, UpdateAudioConfigDto);
			expect(configService.getConfigSection).toHaveBeenCalledWith('audio', AudioConfigEntity);
		});
	});

	describe('updateDisplayConfig', () => {
		it('should update and return the display configuration', async () => {
			const updateDto: UpdateDisplayConfigDto = { brightness: 60, dark_mode: false };
			const updatedConfig = { ...mockConfig.display, ...updateDto };

			jest.spyOn(configService, 'getConfigSection').mockReturnValue(updatedConfig);

			const result = await controller.updateDisplayConfig(updateDto);

			expect(result).toEqual(updatedConfig);
			expect(configService.setConfigSection).toHaveBeenCalledWith('display', updateDto, UpdateDisplayConfigDto);
			expect(configService.getConfigSection).toHaveBeenCalledWith('display', DisplayConfigEntity);
		});
	});

	describe('updateLanguageConfig', () => {
		it('should update and return the language configuration', async () => {
			const updateDto: UpdateLanguageConfigDto = { language: LanguageEnum.CZECH, timezone: 'Europe/Prague' };
			const updatedConfig = { ...mockConfig.language, ...updateDto };

			jest.spyOn(configService, 'getConfigSection').mockReturnValue(updatedConfig);

			const result = await controller.updateLanguageConfig(updateDto);

			expect(result).toEqual(updatedConfig);
			expect(configService.setConfigSection).toHaveBeenCalledWith('language', updateDto, UpdateLanguageConfigDto);
			expect(configService.getConfigSection).toHaveBeenCalledWith('language', LanguageConfigEntity);
		});
	});

	describe('updateWeatherConfig', () => {
		it('should update and return the weather configuration', async () => {
			const updateDto: UpdateWeatherConfigDto = { location: 'Paris', unit: TemperatureUnitEnum.FAHRENHEIT };
			const updatedConfig = { ...mockConfig.weather, ...updateDto };

			jest.spyOn(configService, 'getConfigSection').mockReturnValue(updatedConfig);

			const result = await controller.updateWeatherConfig(updateDto);

			expect(result).toEqual(updatedConfig);
			expect(configService.setConfigSection).toHaveBeenCalledWith('weather', updateDto, UpdateWeatherConfigDto);
			expect(configService.getConfigSection).toHaveBeenCalledWith('weather', WeatherConfigEntity);
		});
	});
});
