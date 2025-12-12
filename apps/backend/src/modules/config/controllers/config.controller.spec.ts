/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { BadRequestException, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigException } from '../config.exceptions';
import { UpdateModuleConfigDto } from '../dto/config.dto';
import { AppConfigModel, ModuleConfigModel } from '../models/config.model';
import { ConfigService } from '../services/config.service';
import { ModulesTypeMapperService } from '../services/modules-type-mapper.service';
import { PluginsTypeMapperService } from '../services/plugins-type-mapper.service';

import { ConfigController } from './config.controller';

describe('ConfigController', () => {
	let controller: ConfigController;
	let configService: ConfigService;

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
		it('should throw BadRequestException for deprecated section endpoints', () => {
			expect(() => controller.getConfigSection('language' as keyof AppConfigModel)).toThrow(BadRequestException);
			expect(() => controller.getConfigSection('system' as keyof AppConfigModel)).toThrow(BadRequestException);
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
