/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ROLES_KEY } from '../../users/guards/roles.guard';
import { UserRole } from '../../users/users.constants';
import { ConfigException, ConfigValidationException } from '../config.exceptions';
import { UpdateModuleConfigDto, UpdatePluginConfigDto } from '../dto/config.dto';
import { AppConfigModel, ModuleConfigModel, PluginConfigModel } from '../models/config.model';
import { ConfigSecretsService } from '../services/config-secrets.service';
import { ConfigService } from '../services/config.service';
import { ModulesTypeMapperService } from '../services/modules-type-mapper.service';
import { PluginConfigValidatorService } from '../services/plugin-config-validator.service';
import { PluginsTypeMapperService } from '../services/plugins-type-mapper.service';

import { ConfigController } from './config.controller';

class MockPluginConfig extends PluginConfigModel {
	type = 'mock-plugin';

	@Expose({ name: 'api_key' })
	@IsOptional()
	@IsString()
	apiKey: string | null = null;
}

class MockPluginConfigDto extends UpdatePluginConfigDto {
	type = 'mock-plugin';

	@Expose({ name: 'api_key' })
	@IsOptional()
	@IsString()
	apiKey?: string | null;
}

describe('ConfigController', () => {
	let controller: ConfigController;
	let configService: ConfigService;
	let pluginConfigValidator: PluginConfigValidatorService;

	const mockConfig: AppConfigModel = {
		path: '/var/smart-panel/config.yml',
		// Language and system config moved to system module (accessible via /config/module/system-module)
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
						getPublicConfig: jest.fn().mockReturnValue(mockConfig),
						getPublicPluginsConfig: jest.fn().mockReturnValue(mockConfig.plugins),
						getPublicPluginConfig: jest.fn(),
						resolvePluginConfigUpdate: jest.fn((_plugin: string, value: MockPluginConfigDto) => value),
						updatePluginConfig: jest.fn(),
						getPublicModulesConfig: jest.fn().mockReturnValue(mockConfig.modules),
						getPublicModuleConfig: jest.fn((_module: string) => mockConfig.modules[0]),
						updateModuleConfig: jest.fn(),
					},
				},
				ConfigSecretsService,
				{
					provide: PluginsTypeMapperService,
					useValue: {
						getMapping: jest.fn(() => ({
							type: 'mock-plugin',
							class: MockPluginConfig,
							configDto: MockPluginConfigDto,
							secretFields: [{ path: 'api_key', configuredPath: 'api_key_configured' }],
						})),
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
				{
					provide: PluginConfigValidatorService,
					useValue: {
						validate: jest.fn().mockResolvedValue({ valid: true }),
						hasValidator: jest.fn().mockReturnValue(false),
					},
				},
			],
		}).compile();

		controller = testingModule.get<ConfigController>(ConfigController);
		configService = testingModule.get<ConfigService>(ConfigService);
		pluginConfigValidator = testingModule.get<PluginConfigValidatorService>(PluginConfigValidatorService);
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
			expect(configService.getPublicConfig).toHaveBeenCalled();
		});
	});

	describe('getModulesConfig', () => {
		it('should return all module configurations', () => {
			const mockModules = mockConfig.modules;
			jest.spyOn(configService, 'getPublicModulesConfig').mockReturnValue(mockModules);

			const result = controller.getModulesConfig();

			expect(result).toHaveProperty('data');
			expect(result.data).toEqual(mockModules);
			expect(configService.getPublicModulesConfig).toHaveBeenCalled();
		});
	});

	describe('validatePluginConfig', () => {
		it('validates with the resolved stored secret while keeping the response secret-free', async () => {
			const resolved = Object.assign(new MockPluginConfigDto(), {
				type: 'mock-plugin',
				apiKey: 'stored-secret',
			});

			jest.spyOn(configService, 'resolvePluginConfigUpdate').mockReturnValue(resolved);
			jest.spyOn(pluginConfigValidator, 'validate').mockResolvedValue({
				valid: false,
				errors: [{ field: 'api_key', message: 'Rejected stored-secret' }],
			});

			const response = await controller.validatePluginConfig('mock-plugin', {
				data: { type: 'mock-plugin' },
			});

			expect(configService.resolvePluginConfigUpdate).toHaveBeenCalledWith(
				'mock-plugin',
				expect.any(MockPluginConfigDto),
				{ type: 'mock-plugin' },
			);
			expect(pluginConfigValidator.validate).toHaveBeenCalledWith(
				'mock-plugin',
				expect.objectContaining({ apiKey: 'stored-secret' }),
			);
			expect(response.data.errors).toEqual([{ field: 'api_key', message: 'Rejected [REDACTED]' }]);
			expect(JSON.stringify(response)).not.toContain('stored-secret');
		});
	});

	describe('updatePluginConfig', () => {
		it('returns a bad request when the resolved stored configuration is invalid', async () => {
			jest
				.spyOn(configService, 'updatePluginConfig')
				.mockRejectedValue(new ConfigValidationException('invalid resolved configuration'));

			await expect(
				controller.updatePluginConfig('mock-plugin', { data: { type: 'mock-plugin', enabled: true } }),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe('getModuleConfig', () => {
		it('should return a specific module configuration', () => {
			const mockModule = mockConfig.modules[0];
			jest.spyOn(configService, 'getPublicModuleConfig').mockReturnValue(mockModule);

			const result = controller.getModuleConfig('mock-module');

			expect(result).toHaveProperty('data');
			expect(result.data).toEqual(mockModule);
			expect(configService.getPublicModuleConfig).toHaveBeenCalledWith('mock-module');
		});

		it('should throw ConfigNotFoundException for a non-existent module', () => {
			(configService.getPublicModuleConfig as jest.Mock).mockImplementation(() => {
				throw new ConfigException("Configuration module 'non-existent' not found.");
			});

			expect(() => controller.getModuleConfig('non-existent')).toThrow();
			expect(configService.getPublicModuleConfig).toHaveBeenCalledWith('non-existent');
		});
	});

	describe('updateModuleConfig', () => {
		it('requires an owner or administrator role', () => {
			expect(Reflect.getMetadata(ROLES_KEY, controller.updateModuleConfig)).toEqual([UserRole.OWNER, UserRole.ADMIN]);
		});

		it('should update and return the module configuration', async () => {
			const updateDto: UpdateModuleConfigDto = { type: 'mock-module', enabled: false };
			const updatedModule = { ...mockConfig.modules[0], enabled: false } as ModuleConfigModel;

			jest.spyOn(configService, 'getPublicModuleConfig').mockReturnValue(updatedModule);
			jest.spyOn(configService, 'updateModuleConfig').mockResolvedValue();

			const result = await controller.updateModuleConfig('mock-module', { data: updateDto });

			expect(result).toHaveProperty('data');
			expect(result.data).toMatchObject({
				type: 'mock-module',
				enabled: false,
			});
			expect(configService.updateModuleConfig).toHaveBeenCalledWith('mock-module', updateDto, updateDto);
			expect(configService.getPublicModuleConfig).toHaveBeenCalledWith('mock-module');
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
