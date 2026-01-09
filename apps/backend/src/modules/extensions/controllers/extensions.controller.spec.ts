/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ExtensionKind } from '../extensions.constants';
import { ExtensionModel } from '../models/extension.model';
import { ExtensionsService } from '../services/extensions.service';

import { ExtensionsController } from './extensions.controller';

describe('ExtensionsController', () => {
	let controller: ExtensionsController;
	let extensionsService: ExtensionsService;

	const createMockExtension = (overrides: Partial<ExtensionModel> = {}): ExtensionModel => {
		const extension = new ExtensionModel();
		extension.type = 'test-module';
		extension.kind = ExtensionKind.MODULE;
		extension.name = 'Test Module';
		extension.enabled = true;
		extension.isCore = false;
		extension.canToggleEnabled = true;
		return { ...extension, ...overrides } as ExtensionModel;
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [ExtensionsController],
			providers: [
				{
					provide: ExtensionsService,
					useValue: {
						findAll: jest.fn(),
						findAllModules: jest.fn(),
						findAllPlugins: jest.fn(),
						findOne: jest.fn(),
						updateEnabled: jest.fn(),
					},
				},
			],
		}).compile();

		controller = module.get<ExtensionsController>(ExtensionsController);
		extensionsService = module.get<ExtensionsService>(ExtensionsService);

	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('findAll', () => {
		it('should return all extensions', () => {
			const mockExtensions = [
				createMockExtension({ type: 'module-1', kind: ExtensionKind.MODULE }),
				createMockExtension({ type: 'plugin-1', kind: ExtensionKind.PLUGIN }),
			];
			jest.spyOn(extensionsService, 'findAll').mockReturnValue(mockExtensions);

			const result = controller.findAll();

			expect(result.data).toHaveLength(2);
			expect(extensionsService.findAll).toHaveBeenCalled();
		});

		it('should return response model with data array', () => {
			jest.spyOn(extensionsService, 'findAll').mockReturnValue([]);

			const result = controller.findAll();

			expect(result).toHaveProperty('data');
			expect(Array.isArray(result.data)).toBe(true);
		});
	});

	describe('findAllModules', () => {
		it('should return only modules', () => {
			const mockModules = [
				createMockExtension({ type: 'module-1', kind: ExtensionKind.MODULE }),
				createMockExtension({ type: 'module-2', kind: ExtensionKind.MODULE }),
			];
			jest.spyOn(extensionsService, 'findAllModules').mockReturnValue(mockModules);

			const result = controller.findAllModules();

			expect(result.data).toHaveLength(2);
			expect(result.data.every((e) => e.kind === ExtensionKind.MODULE)).toBe(true);
			expect(extensionsService.findAllModules).toHaveBeenCalled();
		});
	});

	describe('findAllPlugins', () => {
		it('should return only plugins', () => {
			const mockPlugins = [createMockExtension({ type: 'plugin-1', kind: ExtensionKind.PLUGIN })];
			jest.spyOn(extensionsService, 'findAllPlugins').mockReturnValue(mockPlugins);

			const result = controller.findAllPlugins();

			expect(result.data).toHaveLength(1);
			expect(result.data[0].kind).toBe(ExtensionKind.PLUGIN);
			expect(extensionsService.findAllPlugins).toHaveBeenCalled();
		});
	});

	describe('findOne', () => {
		it('should return a single extension by type', () => {
			const mockExtension = createMockExtension({ type: 'devices-module' });
			jest.spyOn(extensionsService, 'findOne').mockReturnValue(mockExtension);

			const result = controller.findOne('devices-module');

			expect(result.data).toBeDefined();
			expect(result.data.type).toBe('devices-module');
			expect(extensionsService.findOne).toHaveBeenCalledWith('devices-module');
		});
	});

	describe('update', () => {
		it('should update extension enabled status', () => {
			const mockExtension = createMockExtension({ type: 'devices-module', enabled: false });
			jest.spyOn(extensionsService, 'updateEnabled').mockReturnValue(mockExtension);

			const result = controller.update('devices-module', { data: { enabled: false } });

			expect(result.data.enabled).toBe(false);
			expect(extensionsService.updateEnabled).toHaveBeenCalledWith('devices-module', false);
		});

		it('should enable extension', () => {
			const mockExtension = createMockExtension({ type: 'devices-module', enabled: true });
			jest.spyOn(extensionsService, 'updateEnabled').mockReturnValue(mockExtension);

			const result = controller.update('devices-module', { data: { enabled: true } });

			expect(result.data.enabled).toBe(true);
			expect(extensionsService.updateEnabled).toHaveBeenCalledWith('devices-module', true);
		});
	});
});
