/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { UpdatePluginConfigDto } from '../../config/dto/config.dto';
import { ConfigService } from '../../config/services/config.service';
import { ModulesTypeMapperService } from '../../config/services/modules-type-mapper.service';
import { PluginsTypeMapperService } from '../../config/services/plugins-type-mapper.service';
import { ExtensionKind } from '../extensions.constants';
import { ExtensionNotConfigurableException, ExtensionNotFoundException } from '../extensions.exceptions';

import { ExtensionsBundledService } from './extensions-bundled.service';
import { ExtensionsService } from './extensions.service';

describe('ExtensionsService', () => {
	let service: ExtensionsService;
	let configService: ConfigService;
	let modulesMapperService: ModulesTypeMapperService;
	let pluginsMapperService: PluginsTypeMapperService;
	let bundledService: ExtensionsBundledService;

	// Mock classes for mappings
	class MockConfigModel {
		type = 'mock';
		enabled = true;
	}

	// Extends UpdatePluginConfigDto to support enable/disable
	class MockConfigDto extends UpdatePluginConfigDto {
		type = 'mock';
	}

	class MockConfigDtoNoEnabled {
		type = 'mock';
	}

	// Use 'external-module' which is NOT in NON_TOGGLEABLE_MODULES
	const mockModuleMappings = [{ type: 'external-module', class: MockConfigModel, configDto: MockConfigDto }] as never;

	const mockPluginMappings = [
		{ type: 'pages-tiles-plugin', class: MockConfigModel, configDto: MockConfigDto },
	] as never;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ExtensionsService,
				{
					provide: ConfigService,
					useValue: {
						getModuleConfig: jest.fn().mockReturnValue({ enabled: true }),
						getPluginConfig: jest.fn().mockReturnValue({ enabled: true }),
						setModuleConfig: jest.fn(),
						setPluginConfig: jest.fn(),
					},
				},
				{
					provide: ModulesTypeMapperService,
					useValue: {
						getMappings: jest.fn().mockReturnValue(mockModuleMappings),
						getMapping: jest.fn().mockReturnValue({
							type: 'external-module',
							configDto: MockConfigDto,
						}),
					},
				},
				{
					provide: PluginsTypeMapperService,
					useValue: {
						getMappings: jest.fn().mockReturnValue(mockPluginMappings),
						getMapping: jest.fn().mockReturnValue({
							type: 'pages-tiles-plugin',
							configDto: MockConfigDto,
						}),
					},
				},
				{
					provide: ExtensionsBundledService,
					useValue: {
						isCore: jest.fn().mockImplementation((name: string) => {
							return ['external-module', 'pages-tiles-plugin'].includes(name);
						}),
					},
				},
			],
		}).compile();

		service = module.get<ExtensionsService>(ExtensionsService);
		configService = module.get<ConfigService>(ConfigService);
		modulesMapperService = module.get<ModulesTypeMapperService>(ModulesTypeMapperService);
		pluginsMapperService = module.get<PluginsTypeMapperService>(PluginsTypeMapperService);
		bundledService = module.get<ExtensionsBundledService>(ExtensionsBundledService);

	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('registerModuleMetadata', () => {
		it('should register module metadata', () => {
			const metadata = {
				type: 'test-module',
				name: 'Test Module',
				description: 'A test module',
			};

			service.registerModuleMetadata(metadata);

			// Verify by finding the extension
			jest
				.spyOn(modulesMapperService, 'getMappings')
				.mockReturnValue([{ type: 'test-module', class: MockConfigModel, configDto: MockConfigDto }] as never);

			const extensions = service.findAllModules();
			const testModule = extensions.find((e) => e.type === 'test-module');

			expect(testModule).toBeDefined();
			expect(testModule?.name).toBe('Test Module');
			expect(testModule?.description).toBe('A test module');
		});
	});

	describe('registerPluginMetadata', () => {
		it('should register plugin metadata', () => {
			const metadata = {
				type: 'test-plugin',
				name: 'Test Plugin',
				description: 'A test plugin',
			};

			service.registerPluginMetadata(metadata);

			// Verify by finding the extension
			jest
				.spyOn(pluginsMapperService, 'getMappings')
				.mockReturnValue([{ type: 'test-plugin', class: MockConfigModel, configDto: MockConfigDto }] as never);

			const extensions = service.findAllPlugins();
			const testPlugin = extensions.find((e) => e.type === 'test-plugin');

			expect(testPlugin).toBeDefined();
			expect(testPlugin?.name).toBe('Test Plugin');
			expect(testPlugin?.description).toBe('A test plugin');
		});
	});

	describe('findAll', () => {
		it('should return all extensions (modules and plugins)', () => {
			const extensions = service.findAll();

			expect(extensions).toHaveLength(2);
			expect(extensions.some((e) => e.type === 'external-module')).toBe(true);
			expect(extensions.some((e) => e.type === 'pages-tiles-plugin')).toBe(true);
		});

		it('should set correct kind for each extension', () => {
			const extensions = service.findAll();

			const module = extensions.find((e) => e.type === 'external-module');
			const plugin = extensions.find((e) => e.type === 'pages-tiles-plugin');

			expect(module?.kind).toBe(ExtensionKind.MODULE);
			expect(plugin?.kind).toBe(ExtensionKind.PLUGIN);
		});
	});

	describe('findAllModules', () => {
		it('should return only modules', () => {
			const modules = service.findAllModules();

			expect(modules).toHaveLength(1);
			expect(modules[0].type).toBe('external-module');
			expect(modules[0].kind).toBe(ExtensionKind.MODULE);
		});
	});

	describe('findAllPlugins', () => {
		it('should return only plugins', () => {
			const plugins = service.findAllPlugins();

			expect(plugins).toHaveLength(1);
			expect(plugins[0].type).toBe('pages-tiles-plugin');
			expect(plugins[0].kind).toBe(ExtensionKind.PLUGIN);
		});
	});

	describe('findOne', () => {
		it('should return a module by type', () => {
			const extension = service.findOne('external-module');

			expect(extension).toBeDefined();
			expect(extension.type).toBe('external-module');
			expect(extension.kind).toBe(ExtensionKind.MODULE);
		});

		it('should return a plugin by type', () => {
			const extension = service.findOne('pages-tiles-plugin');

			expect(extension).toBeDefined();
			expect(extension.type).toBe('pages-tiles-plugin');
			expect(extension.kind).toBe(ExtensionKind.PLUGIN);
		});

		it('should throw ExtensionNotFoundException for unknown extension', () => {
			expect(() => service.findOne('unknown-extension')).toThrow(ExtensionNotFoundException);
		});
	});

	describe('updateEnabled', () => {
		it('should update module enabled status', () => {
			service.updateEnabled('external-module', false);

			expect(configService.setModuleConfig).toHaveBeenCalledWith('external-module', {
				type: 'external-module',
				enabled: false,
			});
		});

		it('should update plugin enabled status', () => {
			service.updateEnabled('pages-tiles-plugin', false);

			expect(configService.setPluginConfig).toHaveBeenCalledWith('pages-tiles-plugin', {
				type: 'pages-tiles-plugin',
				enabled: false,
			});
		});

		it('should throw ExtensionNotConfigurableException when plugin DTO has no enabled property', () => {
			// Mock mapping with no enabled property
			jest.spyOn(pluginsMapperService, 'getMapping').mockReturnValue({
				type: 'pages-tiles-plugin',
				configDto: MockConfigDtoNoEnabled,
			} as never);

			expect(() => service.updateEnabled('pages-tiles-plugin', false)).toThrow(ExtensionNotConfigurableException);
		});
	});

	describe('isCore property', () => {
		it('should set isCore based on bundled service', () => {
			const extension = service.findOne('external-module');

			expect(extension.isCore).toBe(true);
			expect(bundledService.isCore).toHaveBeenCalledWith('external-module');
		});

		it('should set isCore to false for non-bundled extensions', () => {
			jest.spyOn(bundledService, 'isCore').mockReturnValue(false);
			jest
				.spyOn(modulesMapperService, 'getMappings')
				.mockReturnValue([{ type: 'external-module', class: MockConfigModel, configDto: MockConfigDto }] as never);

			const modules = service.findAllModules();
			const externalModule = modules.find((e) => e.type === 'external-module');

			expect(externalModule?.isCore).toBe(false);
		});
	});

	describe('formatName', () => {
		it('should format extension type to human-readable name when no metadata', () => {
			// Add a mapping without metadata
			jest
				.spyOn(modulesMapperService, 'getMappings')
				.mockReturnValue([{ type: 'my-custom-module', class: MockConfigModel, configDto: MockConfigDto }] as never);

			const modules = service.findAllModules();
			const customModule = modules.find((e) => e.type === 'my-custom-module');

			expect(customModule?.name).toBe('My Custom');
		});
	});
});
