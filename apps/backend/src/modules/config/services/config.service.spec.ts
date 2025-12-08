/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Expose, Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import * as fs from 'fs';
import path from 'path';
import * as yaml from 'yaml';

import { Logger } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { PlatformService } from '../../platform/services/platform.service';
import {
	EventType,
	LanguageType,
	LogLevelType,
	SectionType,
	TemperatureUnitType,
	TimeFormatType,
	WeatherLocationType,
} from '../config.constants';
import { ConfigNotFoundException, ConfigValidationException } from '../config.exceptions';
import { UpdateAudioConfigDto, UpdateModuleConfigDto, UpdatePluginConfigDto } from '../dto/config.dto';
import {
	AppConfigModel,
	AudioConfigModel,
	BaseConfigModel,
	ModuleConfigModel,
	PluginConfigModel,
} from '../models/config.model';

import { ConfigService } from './config.service';
import { ModulesTypeMapperService } from './modules-type-mapper.service';
import { PluginsTypeMapperService } from './plugins-type-mapper.service';

jest.mock('fs');

jest.mock('yaml', () => ({
	parse: jest.fn(),
	stringify: jest.fn(),
}));

class MockPluginConfig extends PluginConfigModel {
	type = 'mock';

	@Expose({ name: 'mock_value' })
	@IsString()
	@Transform(({ obj }: { obj: { mock_value?: string; mockValue?: string } }) => obj.mock_value || obj.mockValue, {
		toClassOnly: true,
	})
	mockValue: string = 'default value';
}

class PluginConfigDto extends UpdatePluginConfigDto {
	@Expose()
	@IsOptional()
	@IsString()
	mock_value?: string;
}

class MockModuleConfig extends ModuleConfigModel {
	type = 'mock-module';

	@Expose({ name: 'mock_value' })
	@IsString()
	@Transform(({ obj }: { obj: { mock_value?: string; mockValue?: string } }) => obj.mock_value || obj.mockValue, {
		toClassOnly: true,
	})
	mockValue: string = 'default value';
}

class ModuleConfigDto extends UpdateModuleConfigDto {
	@Expose()
	@IsOptional()
	@IsString()
	mock_value?: string;
}

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
		plugins: {
			mock: {
				enabled: true,
				mockValue: 'default value',
			},
		},
		modules: {
			'mock-module': {
				enabled: true,
				mockValue: 'default value',
			},
		},
	};

	const mockConfig: Partial<AppConfigModel> = {
		path: '/var/smart-panel/config.yaml',
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
			cityName: null,
			latitude: null,
			longitude: null,
			locationType: WeatherLocationType.CITY_NAME,
			openWeatherApiKey: null,
			unit: TemperatureUnitType.CELSIUS,
		},
		system: {
			type: SectionType.SYSTEM,
			logLevels: [LogLevelType.INFO, LogLevelType.WARN, LogLevelType.ERROR, LogLevelType.FATAL],
		},
		plugins: [
			{
				type: 'mock',
				enabled: true,
				mockValue: 'default value',
			} as PluginConfigModel,
		],
		modules: [
			{
				type: 'mock-module',
				enabled: true,
				mockValue: 'default value',
			} as ModuleConfigModel,
		],
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
					provide: PluginsTypeMapperService,
					useValue: {
						onMappingsRegistered: jest.fn(() => {}),
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => ({
							type: 'mock',
							class: MockPluginConfig,
							configDto: PluginConfigDto,
						})),
						getMappings: jest.fn(() => [
							{
								type: 'mock',
								class: MockPluginConfig,
								configDto: PluginConfigDto,
							},
						]),
					},
				},
				{
					provide: ModulesTypeMapperService,
					useValue: {
						onMappingsRegistered: jest.fn(() => {}),
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => ({
							type: 'mock-module',
							class: MockModuleConfig,
							configDto: ModuleConfigDto,
						})),
						getMappings: jest.fn(() => [
							{
								type: 'mock-module',
								class: MockModuleConfig,
								configDto: ModuleConfigDto,
							},
						]),
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

			jest.spyOn(service as any, 'configPath', 'get').mockReturnValue('/var/smart-panel/');

			const toCompare = toInstance(AppConfigModel, mockConfig);
			toCompare.plugins = [toInstance(MockPluginConfig, mockConfig.plugins[0])];
			toCompare.modules = [toInstance(MockModuleConfig, mockConfig.modules[0])];

			expect(service.getConfig()).toEqual(toCompare);

			expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']));
			expect(fs.readFileSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']), 'utf8');
			expect(yaml.parse).toHaveBeenCalledWith(JSON.stringify(mockRawConfig));
		});

		it('should throw ConfigValidationException if validation fails', () => {
			const invalidConfig = { audio: { invalidField: 'value' } };

			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(invalidConfig));
			jest.spyOn(yaml, 'parse').mockReturnValue(invalidConfig);

			expect(() => service['loadConfig']()).toThrow(ConfigValidationException);

			expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']));
			expect(fs.readFileSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']), 'utf8');
			expect(yaml.parse).toHaveBeenCalledWith(JSON.stringify(invalidConfig));
		});
	});

	describe('getConfig', () => {
		it('should return the entire configuration', () => {
			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockRawConfig));
			jest.spyOn(yaml, 'parse').mockReturnValue(mockRawConfig);

			jest.spyOn(service as any, 'configPath', 'get').mockReturnValue('/var/smart-panel/');

			const toCompare = toInstance(AppConfigModel, mockConfig);
			toCompare.plugins = [toInstance(MockPluginConfig, mockConfig.plugins[0])];
			toCompare.modules = [toInstance(MockModuleConfig, mockConfig.modules[0])];

			expect(service.getConfig()).toEqual(toCompare);

			expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']));
			expect(fs.readFileSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']), 'utf8');
			expect(yaml.parse).toHaveBeenCalledWith(JSON.stringify(mockRawConfig));
		});
	});

	describe('getConfigSection', () => {
		it('should return a valid configuration section', () => {
			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockRawConfig));
			jest.spyOn(yaml, 'parse').mockReturnValue(mockRawConfig);

			const result = service.getConfigSection(SectionType.AUDIO, AudioConfigModel);

			expect(result).toEqual(mockConfig.audio);

			expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']));
			expect(fs.readFileSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']), 'utf8');
			expect(yaml.parse).toHaveBeenCalledWith(JSON.stringify(mockRawConfig));
		});

		it('should throw validation errors for an invalid section', () => {
			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockRawConfig));
			jest.spyOn(yaml, 'parse').mockReturnValue(mockRawConfig);

			class MockConfig extends BaseConfigModel {}

			// @ts-expect-error: This is an intentional test for invalid configuration sections
			expect(() => service.getConfigSection('invalid', MockConfig)).toThrow(ConfigNotFoundException);

			expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']));
			expect(fs.readFileSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']), 'utf8');
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

			const mockYamlStringify = jest.spyOn(yaml, 'stringify');
			const mockFsWriteFileSync = jest.spyOn(fs, 'writeFileSync');

			await service.setConfigSection(SectionType.AUDIO, updatedAudioConfig, UpdateAudioConfigDto);

			expect(service['config'].audio).toEqual(mergedConfig);

			expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']));
			expect(fs.readFileSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']), 'utf8');
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

			await expect(service.setConfigSection(SectionType.AUDIO, invalidUpdateDto, UpdateAudioConfigDto)).rejects.toThrow(
				ConfigValidationException,
			);

			expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']));
			expect(fs.readFileSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']), 'utf8');
			expect(yaml.parse).toHaveBeenCalledWith(JSON.stringify(mockRawConfig));
		});
	});

	describe('getPluginConfig', () => {
		it('should return a valid plugin configuration', () => {
			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockRawConfig));
			jest.spyOn(yaml, 'parse').mockReturnValue(mockRawConfig);

			const result = service.getPluginConfig('mock');

			expect(result).toEqual(mockConfig.plugins[0]);

			expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']));
			expect(fs.readFileSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']), 'utf8');
			expect(yaml.parse).toHaveBeenCalledWith(JSON.stringify(mockRawConfig));
		});

		it('should throw validation errors for an invalid plugin', () => {
			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockRawConfig));
			jest.spyOn(yaml, 'parse').mockReturnValue(mockRawConfig);

			expect(() => service.getPluginConfig('invalid')).toThrow(ConfigNotFoundException);

			expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']));
			expect(fs.readFileSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']), 'utf8');
			expect(yaml.parse).toHaveBeenCalledWith(JSON.stringify(mockRawConfig));
		});
	});

	describe('setPluginConfig', () => {
		it('should update a plugin configuration and save it to YAML', () => {
			const updatedPluginConfig: PluginConfigDto = {
				type: 'mock',
				mock_value: 'Updated value',
			};
			const mergedConfig = { ...mockConfig.plugins[0], ...{ enabled: true, mockValue: 'Updated value' } };

			const updatedRawConfig = {
				...mockRawConfig,
				...{ plugins: { mock: { enabled: true, mock_value: 'Updated value' } } },
			};

			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest
				.spyOn(fs, 'readFileSync')
				.mockReturnValueOnce(JSON.stringify(mockRawConfig))
				.mockReturnValueOnce(JSON.stringify(updatedRawConfig));
			jest.spyOn(yaml, 'parse').mockReturnValueOnce(mockRawConfig).mockReturnValueOnce(updatedRawConfig);

			const mockYamlStringify = jest.spyOn(yaml, 'stringify');
			const mockFsWriteFileSync = jest.spyOn(fs, 'writeFileSync');

			service.setPluginConfig('mock', updatedPluginConfig);

			expect(service['config'].plugins[0]).toEqual(mergedConfig);

			expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']));
			expect(fs.readFileSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']), 'utf8');
			expect(yaml.parse).toHaveBeenCalledWith(JSON.stringify(mockRawConfig));
			expect(yaml.parse).toHaveBeenCalledWith(JSON.stringify(updatedRawConfig));
			expect(mockYamlStringify).toHaveBeenCalled();
			expect(mockFsWriteFileSync).toHaveBeenCalled();
			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.CONFIG_UPDATED, service['config']);
		});

		it('should throw validation errors for an invalid update', () => {
			const invalidUpdateDto: PluginConfigDto & { invalidField: string } = {
				type: 'mock',
				invalidField: 'value',
			};

			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockRawConfig));
			jest.spyOn(yaml, 'parse').mockReturnValue(mockRawConfig);

			expect(() => service.setPluginConfig('mock', invalidUpdateDto)).toThrow(ConfigValidationException);

			expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']));
			expect(fs.readFileSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']), 'utf8');
			expect(yaml.parse).toHaveBeenCalledWith(JSON.stringify(mockRawConfig));
		});
	});

	describe('getModulesConfig', () => {
		it('should return all module configurations', () => {
			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockRawConfig));
			jest.spyOn(yaml, 'parse').mockReturnValue(mockRawConfig);

			const result = service.getModulesConfig();

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual(mockConfig.modules[0]);

			expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']));
			expect(fs.readFileSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']), 'utf8');
			expect(yaml.parse).toHaveBeenCalledWith(JSON.stringify(mockRawConfig));
		});

		it('should return default modules when modules section is missing', () => {
			const configWithoutModules = { ...mockRawConfig };
			delete configWithoutModules.modules;

			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(configWithoutModules));
			jest.spyOn(yaml, 'parse').mockReturnValue(configWithoutModules);

			// Force config reload
			service['config'] = null;

			const result = service.getModulesConfig();

			// When modules section is missing, loadModules creates default instances from registered mappings
			expect(result).toHaveLength(1);
			expect(result[0]).toHaveProperty('type', 'mock-module');
			expect(result[0]).toHaveProperty('enabled', false); // default value

			expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']));
			expect(fs.readFileSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']), 'utf8');
			expect(yaml.parse).toHaveBeenCalledWith(JSON.stringify(configWithoutModules));
		});
	});

	describe('getModuleConfig', () => {
		it('should return a valid module configuration', () => {
			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockRawConfig));
			jest.spyOn(yaml, 'parse').mockReturnValue(mockRawConfig);

			const result = service.getModuleConfig('mock-module');

			expect(result).toEqual(mockConfig.modules[0]);

			expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']));
			expect(fs.readFileSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']), 'utf8');
			expect(yaml.parse).toHaveBeenCalledWith(JSON.stringify(mockRawConfig));
		});

		it('should throw ConfigNotFoundException for an invalid module', () => {
			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockRawConfig));
			jest.spyOn(yaml, 'parse').mockReturnValue(mockRawConfig);

			expect(() => service.getModuleConfig('invalid-module')).toThrow(ConfigNotFoundException);

			expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']));
			expect(fs.readFileSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']), 'utf8');
			expect(yaml.parse).toHaveBeenCalledWith(JSON.stringify(mockRawConfig));
		});
	});

	describe('setModuleConfig', () => {
		it('should update a module configuration and save it to YAML', () => {
			const updatedModuleConfig: ModuleConfigDto = {
				type: 'mock-module',
				mock_value: 'Updated value',
			};
			const mergedConfig = { ...mockConfig.modules[0], ...{ enabled: true, mockValue: 'Updated value' } };

			const updatedRawConfig = {
				...mockRawConfig,
				...{ modules: { 'mock-module': { enabled: true, mock_value: 'Updated value' } } },
			};

			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest
				.spyOn(fs, 'readFileSync')
				.mockReturnValueOnce(JSON.stringify(mockRawConfig))
				.mockReturnValueOnce(JSON.stringify(updatedRawConfig));
			jest.spyOn(yaml, 'parse').mockReturnValueOnce(mockRawConfig).mockReturnValueOnce(updatedRawConfig);

			const mockYamlStringify = jest.spyOn(yaml, 'stringify');
			const mockFsWriteFileSync = jest.spyOn(fs, 'writeFileSync');

			service.setModuleConfig('mock-module', updatedModuleConfig);

			expect(service['config'].modules[0]).toEqual(mergedConfig);

			expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']));
			expect(fs.readFileSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']), 'utf8');
			expect(yaml.parse).toHaveBeenCalledWith(JSON.stringify(mockRawConfig));
			expect(yaml.parse).toHaveBeenCalledWith(JSON.stringify(updatedRawConfig));
			expect(mockYamlStringify).toHaveBeenCalled();
			expect(mockFsWriteFileSync).toHaveBeenCalled();
			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.CONFIG_UPDATED, service['config']);
		});

		it('should throw validation errors for an invalid update', () => {
			const invalidUpdateDto: ModuleConfigDto & { invalidField: string } = {
				type: 'mock-module',
				invalidField: 'value',
			};

			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockRawConfig));
			jest.spyOn(yaml, 'parse').mockReturnValue(mockRawConfig);

			expect(() => service.setModuleConfig('mock-module', invalidUpdateDto)).toThrow(ConfigValidationException);

			expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']));
			expect(fs.readFileSync).toHaveBeenCalledWith(path.resolve(service['configPath'], service['filename']), 'utf8');
			expect(yaml.parse).toHaveBeenCalledWith(JSON.stringify(mockRawConfig));
		});
	});
});
