/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { plainToInstance } from 'class-transformer';
import * as fs from 'fs';
import path from 'path';
import * as yaml from 'yaml';

import { Logger } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { PlatformService } from '../../platform/services/platform.service';
import {
	EventType,
	LanguageType,
	SectionType,
	TemperatureUnitType,
	TimeFormatType,
	WeatherLocationTypeType,
} from '../config.constants';
import { ConfigNotFoundException, ConfigValidationException } from '../config.exceptions';
import { UpdateAudioConfigDto } from '../dto/config.dto';
import { AppConfigEntity, AudioConfigEntity, BaseConfigEntity } from '../entities/config.entity';

import { ConfigService } from './config.service';

jest.mock('fs');

jest.mock('yaml', () => ({
	parse: jest.fn(),
	stringify: jest.fn(),
}));

describe('ConfigService', () => {
	let service: ConfigService;
	let eventEmitter: EventEmitter2;
	let platform: PlatformService;

	const mockRawConfig = {
		audio: {
			speaker: true,
			speaker_volume: 50,
			microphone: false,
			microphone_volume: 30,
		},
	};

	const mockConfig: Partial<AppConfigEntity> = {
		audio: {
			type: SectionType.AUDIO,
			speaker: true,
			speakerVolume: 50,
			microphone: false,
			microphoneVolume: 30,
		},
		display: {
			type: SectionType.DISPLAY,
			brightness: 0,
			darkMode: false,
			screenLockDuration: 30,
			screenSaver: true,
		},
		language: {
			type: SectionType.LANGUAGE,
			language: LanguageType.ENGLISH,
			timeFormat: TimeFormatType.HOUR_24,
			timezone: 'Europe/Prague',
		},
		weather: {
			type: SectionType.WEATHER,
			location: null,
			locationType: WeatherLocationTypeType.CITY_NAME,
			openWeatherApiKey: null,
			unit: TemperatureUnitType.CELSIUS,
		},
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			imports: [NestConfigModule],
			providers: [
				ConfigService,
				{
					provide: PlatformService,
					useValue: {
						setSpeakerVolume: jest.fn(() => {}),
						muteSpeaker: jest.fn(() => {}),
						setMicrophoneVolume: jest.fn(() => {}),
						muteMicrophone: jest.fn(() => {}),
					},
				},
				{
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(() => {}),
					},
				},
			],
		}).compile();

		service = module.get<ConfigService>(ConfigService);
		eventEmitter = module.get<EventEmitter2>(EventEmitter2);
		platform = module.get<PlatformService>(PlatformService);

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
		expect(eventEmitter).toBeDefined();
		expect(platform).toBeDefined();
	});

	describe('loadConfig', () => {
		it('should load and validate config from a YAML file', () => {
			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockRawConfig));
			jest.spyOn(yaml, 'parse').mockReturnValue(mockRawConfig);

			service['loadConfig']();

			expect(service['config']).toEqual(
				plainToInstance(AppConfigEntity, mockConfig, {
					enableImplicitConversion: true,
					exposeUnsetFields: false,
				}),
			);

			expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(service['getConfigPath'](), service['filename']));
			expect(fs.readFileSync).toHaveBeenCalledWith(
				path.resolve(service['getConfigPath'](), service['filename']),
				'utf8',
			);
			expect(yaml.parse).toHaveBeenCalledWith(JSON.stringify(mockRawConfig));
		});

		it('should throw ConfigValidationException if validation fails', () => {
			const invalidConfig = { audio: { invalidField: 'value' } };

			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(invalidConfig));
			jest.spyOn(yaml, 'parse').mockReturnValue(invalidConfig);

			expect(() => service['loadConfig']()).toThrow(ConfigValidationException);

			expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(service['getConfigPath'](), service['filename']));
			expect(fs.readFileSync).toHaveBeenCalledWith(
				path.resolve(service['getConfigPath'](), service['filename']),
				'utf8',
			);
			expect(yaml.parse).toHaveBeenCalledWith(JSON.stringify(invalidConfig));
		});
	});

	describe('getConfig', () => {
		it('should return the entire configuration', () => {
			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockRawConfig));
			jest.spyOn(yaml, 'parse').mockReturnValue(mockRawConfig);

			service['loadConfig']();

			expect(service.getConfig()).toEqual(
				plainToInstance(AppConfigEntity, mockConfig, {
					enableImplicitConversion: true,
					exposeUnsetFields: false,
				}),
			);

			expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(service['getConfigPath'](), service['filename']));
			expect(fs.readFileSync).toHaveBeenCalledWith(
				path.resolve(service['getConfigPath'](), service['filename']),
				'utf8',
			);
			expect(yaml.parse).toHaveBeenCalledWith(JSON.stringify(mockRawConfig));
		});
	});

	describe('getConfigSection', () => {
		it('should return a valid configuration section', () => {
			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockRawConfig));
			jest.spyOn(yaml, 'parse').mockReturnValue(mockRawConfig);

			service['loadConfig']();

			const result = service.getConfigSection(SectionType.AUDIO, AudioConfigEntity);

			expect(result).toEqual(mockConfig.audio);

			expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(service['getConfigPath'](), service['filename']));
			expect(fs.readFileSync).toHaveBeenCalledWith(
				path.resolve(service['getConfigPath'](), service['filename']),
				'utf8',
			);
			expect(yaml.parse).toHaveBeenCalledWith(JSON.stringify(mockRawConfig));
		});

		it('should throw validation errors for an invalid section', () => {
			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockRawConfig));
			jest.spyOn(yaml, 'parse').mockReturnValue(mockRawConfig);

			service['loadConfig']();

			class MockConfig extends BaseConfigEntity {}

			// @ts-expect-error: This is an intentional test for invalid configuration sections
			expect(() => service.getConfigSection('invalid', MockConfig)).toThrow(ConfigNotFoundException);

			expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(service['getConfigPath'](), service['filename']));
			expect(fs.readFileSync).toHaveBeenCalledWith(
				path.resolve(service['getConfigPath'](), service['filename']),
				'utf8',
			);
			expect(yaml.parse).toHaveBeenCalledWith(JSON.stringify(mockRawConfig));
		});
	});

	describe('setConfigSection', () => {
		it('should update a configuration section and save it to YAML', async () => {
			const updatedAudioConfig: UpdateAudioConfigDto & { speaker_volume?: number } = {
				type: SectionType.AUDIO,
				speaker: false,
				speaker_volume: 20,
			};
			const mergedConfig = { ...mockConfig.audio, ...{ speaker: false, speakerVolume: 20 } };

			const updatedRawConfig = {
				...mockRawConfig,
				...{ audio: { ...mockRawConfig.audio, speaker: false, speaker_volume: 20 } },
			};

			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest
				.spyOn(fs, 'readFileSync')
				.mockReturnValueOnce(JSON.stringify(mockRawConfig))
				.mockReturnValueOnce(JSON.stringify(updatedRawConfig));
			jest.spyOn(yaml, 'parse').mockReturnValueOnce(mockRawConfig).mockReturnValueOnce(updatedRawConfig);

			service['loadConfig']();

			const mockYamlStringify = jest.spyOn(yaml, 'stringify');
			const mockFsWriteFileSync = jest.spyOn(fs, 'writeFileSync');

			await service.setConfigSection(SectionType.AUDIO, updatedAudioConfig, UpdateAudioConfigDto);

			expect(service['config'].audio).toEqual(mergedConfig);

			expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(service['getConfigPath'](), service['filename']));
			expect(fs.readFileSync).toHaveBeenCalledWith(
				path.resolve(service['getConfigPath'](), service['filename']),
				'utf8',
			);
			expect(yaml.parse).toHaveBeenCalledWith(JSON.stringify(mockRawConfig));
			expect(yaml.parse).toHaveBeenCalledWith(JSON.stringify(updatedRawConfig));
			expect(mockYamlStringify).toHaveBeenCalled();
			expect(mockFsWriteFileSync).toHaveBeenCalled();
			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.CONFIG_UPDATED, service['config']);
		});

		it('should throw validation errors for an invalid update', async () => {
			const invalidUpdateDto: UpdateAudioConfigDto & { invalidField: string } = {
				type: SectionType.AUDIO,
				invalidField: 'value',
			};

			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockRawConfig));
			jest.spyOn(yaml, 'parse').mockReturnValue(mockRawConfig);

			service['loadConfig']();

			await expect(service.setConfigSection(SectionType.AUDIO, invalidUpdateDto, UpdateAudioConfigDto)).rejects.toThrow(
				ConfigValidationException,
			);

			expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(service['getConfigPath'](), service['filename']));
			expect(fs.readFileSync).toHaveBeenCalledWith(
				path.resolve(service['getConfigPath'](), service['filename']),
				'utf8',
			);
			expect(yaml.parse).toHaveBeenCalledWith(JSON.stringify(mockRawConfig));
		});
	});
});
