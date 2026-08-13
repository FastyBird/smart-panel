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

import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { PlatformService } from '../../platform/services/platform.service';
import { EventType } from '../config.constants';
import { ConfigNotFoundException, ConfigValidationException } from '../config.exceptions';
import { UpdateModuleConfigDto, UpdatePluginConfigDto } from '../dto/config.dto';
import { AppConfigModel, ModuleConfigModel, PluginConfigModel } from '../models/config.model';

import { ConfigSecretsService } from './config-secrets.service';
import { ConfigService } from './config.service';
import { ModuleConfigMutationRegistryService } from './module-config-mutation-registry.service';
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

	@Expose({ name: 'secret_value' })
	@IsOptional()
	@IsString()
	secretValue: string | null = null;
}

class PluginConfigDto extends UpdatePluginConfigDto {
	@Expose()
	@IsOptional()
	@IsString()
	mock_value?: string;

	@Expose({ name: 'secret_value' })
	@IsOptional()
	@IsString()
	secretValue?: string | null;
}

class MockModuleConfig extends ModuleConfigModel {
	type = 'mock-module';

	@Expose({ name: 'mock_value' })
	@IsString()
	@Transform(({ obj }: { obj: { mock_value?: string; mockValue?: string } }) => obj.mock_value || obj.mockValue, {
		toClassOnly: true,
	})
	mockValue: string = 'default value';

	@Expose({ name: 'secret_value' })
	@IsOptional()
	@IsString()
	secretValue: string | null = null;
}

class ModuleConfigDto extends UpdateModuleConfigDto {
	@Expose()
	@IsOptional()
	@IsString()
	mock_value?: string;

	@Expose({ name: 'secret_value' })
	@IsOptional()
	@IsString()
	secretValue?: string | null;
}

describe('ConfigService', () => {
	let service: ConfigService;
	let eventEmitter: EventEmitter2;
	let moduleConfigMutations: ModuleConfigMutationRegistryService;
	let platform: PlatformService;

	const mockRawConfig = {
		// Language and system config moved to modules.system-module
		plugins: {
			mock: {
				enabled: true,
				mockValue: 'default value',
				secret_value: 'stored-plugin-secret',
			},
		},
		modules: {
			'mock-module': {
				enabled: true,
				mockValue: 'default value',
				secret_value: 'stored-module-secret',
			},
		},
	};

	const mockConfig: Partial<AppConfigModel> = {
		path: '/var/smart-panel/config.yaml',
		// Language and system config moved to system module (accessible via /config/module/system-module)
		plugins: [
			{
				type: 'mock',
				enabled: true,
				mockValue: 'default value',
				secretValue: 'stored-plugin-secret',
			} as PluginConfigModel,
		],
		modules: [
			{
				type: 'mock-module',
				enabled: true,
				mockValue: 'default value',
				secretValue: 'stored-module-secret',
			} as ModuleConfigModel,
		],
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			imports: [NestConfigModule],
			providers: [
				ConfigService,
				ConfigSecretsService,
				ModuleConfigMutationRegistryService,
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
							secretFields: [{ path: 'secret_value', configuredPath: 'secret_value_configured' }],
						})),
						getMappings: jest.fn(() => [
							{
								type: 'mock',
								class: MockPluginConfig,
								configDto: PluginConfigDto,
								secretFields: [{ path: 'secret_value', configuredPath: 'secret_value_configured' }],
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
							secretFields: [{ path: 'secret_value', configuredPath: 'secret_value_configured' }],
						})),
						getMappings: jest.fn(() => [
							{
								type: 'mock-module',
								class: MockModuleConfig,
								configDto: ModuleConfigDto,
								secretFields: [{ path: 'secret_value', configuredPath: 'secret_value_configured' }],
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
		moduleConfigMutations = module.get<ModuleConfigMutationRegistryService>(ModuleConfigMutationRegistryService);
		platform = module.get<PlatformService>(PlatformService);
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

		it('returns a public configuration without plugin or module secrets', () => {
			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockRawConfig));
			jest.spyOn(yaml, 'parse').mockReturnValue(mockRawConfig);

			const result = service.getPublicConfig() as unknown as {
				plugins: Array<Record<string, unknown>>;
				modules: Array<Record<string, unknown>>;
			};

			expect(result.plugins[0]).toMatchObject({
				type: 'mock',
				secret_value_configured: true,
			});
			expect(result.plugins[0]).not.toHaveProperty('secret_value');
			expect(result.modules[0]).toMatchObject({
				type: 'mock-module',
				secret_value_configured: true,
			});
			expect(result.modules[0]).not.toHaveProperty('secret_value');
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

		it('returns a configured indicator instead of the secret from the public getter', () => {
			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockRawConfig));
			jest.spyOn(yaml, 'parse').mockReturnValue(mockRawConfig);

			const result = service.getPublicPluginConfig('mock') as unknown as Record<string, unknown>;

			expect(result).toMatchObject({ secret_value_configured: true });
			expect(result).not.toHaveProperty('secret_value');
			expect(service.getPluginConfig<MockPluginConfig>('mock').secretValue).toBe('stored-plugin-secret');
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
				plugins: {
					mock: {
						enabled: true,
						mock_value: 'Updated value',
						secret_value: 'stored-plugin-secret',
					},
				},
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
			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.CONFIG_UPDATED, {
				source: 'mock',
				type: 'plugin',
			});
		});

		const secretUpdates: ReadonlyArray<readonly [string | null, string | null]> = [
			['replacement', 'replacement'],
			[null, null],
		];

		it.each(secretUpdates)(
			'persists an explicitly submitted secret value %p',
			(submittedSecret: string | null, expectedSecret: string | null) => {
				const updatedRawConfig = {
					...mockRawConfig,
					plugins: {
						mock: {
							enabled: true,
							mock_value: 'default value',
							secret_value: expectedSecret,
						},
					},
				};

				jest.spyOn(fs, 'existsSync').mockReturnValue(true);
				jest
					.spyOn(fs, 'readFileSync')
					.mockReturnValueOnce(JSON.stringify(mockRawConfig))
					.mockReturnValueOnce(JSON.stringify(updatedRawConfig));
				jest.spyOn(yaml, 'parse').mockReturnValueOnce(mockRawConfig).mockReturnValueOnce(updatedRawConfig);

				service.setPluginConfig('mock', toInstance(PluginConfigDto, { type: 'mock', secret_value: submittedSecret }), {
					type: 'mock',
					secret_value: submittedSecret,
				});

				expect(service.getPluginConfig<MockPluginConfig>('mock').secretValue).toBe(expectedSecret);
				expect(yaml.stringify).toHaveBeenCalled();
			},
		);

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
				modules: {
					'mock-module': {
						enabled: true,
						mock_value: 'Updated value',
						secret_value: 'stored-module-secret',
					},
				},
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
			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.CONFIG_UPDATED, {
				source: 'mock-module',
				type: 'module',
			});
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

	describe('updateModuleConfig', () => {
		it('runs registered module mutations with resolved secrets around persistence', async () => {
			const loadedConfig = toInstance(AppConfigModel, mockConfig);
			loadedConfig.plugins = [toInstance(MockPluginConfig, mockConfig.plugins[0])];
			loadedConfig.modules = [toInstance(MockModuleConfig, mockConfig.modules[0])];
			service['config'] = loadedConfig;

			const commit = jest.spyOn(service, 'setModuleConfig').mockImplementation(() => {});
			moduleConfigMutations.register('mock-module', async (update, persist) => {
				expect(update).toMatchObject({
					type: 'mock-module',
					enabled: false,
					secretValue: 'stored-module-secret',
				});
				await persist();
			});

			await service.updateModuleConfig(
				'mock-module',
				{ type: 'mock-module', enabled: false },
				{ type: 'mock-module', enabled: false },
			);

			expect(commit).toHaveBeenCalledWith(
				'mock-module',
				expect.objectContaining({ secretValue: 'stored-module-secret' }),
				expect.objectContaining({ secret_value: 'stored-module-secret' }),
			);
		});
	});
});
