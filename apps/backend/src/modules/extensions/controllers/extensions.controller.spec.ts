/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Test, TestingModule } from '@nestjs/testing';

import { ExtensionKind } from '../extensions.constants';
import { ExtensionModel } from '../models/extension.model';
import { ExtensionsBulkService } from '../services/extensions-bulk.service';
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

	const mockExtensionsBulkService = {
		setEnabled: jest.fn().mockResolvedValue({ succeeded: [], failed: [] }),
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
				{
					provide: ExtensionsBulkService,
					useValue: mockExtensionsBulkService,
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
		it('should update extension enabled status', async () => {
			const mockExtension = createMockExtension({ type: 'devices-module', enabled: false });
			jest.spyOn(extensionsService, 'updateEnabled').mockResolvedValue(mockExtension);

			const result = await controller.update('devices-module', { data: { enabled: false } });

			expect(result.data.enabled).toBe(false);
			expect(extensionsService.updateEnabled).toHaveBeenCalledWith('devices-module', false);
		});

		it('should enable extension', async () => {
			const mockExtension = createMockExtension({ type: 'devices-module', enabled: true });
			jest.spyOn(extensionsService, 'updateEnabled').mockResolvedValue(mockExtension);

			const result = await controller.update('devices-module', { data: { enabled: true } });

			expect(result.data.enabled).toBe(true);
			expect(extensionsService.updateEnabled).toHaveBeenCalledWith('devices-module', true);
		});
	});

	describe('bulkUpdate', () => {
		// Extensions are addressed by type, not by a generated id, so the selection
		// travels as types all the way through.
		it('hands the whole selection to the bulk service in one call', async () => {
			const types = ['devices-shelly-ng-plugin', 'devices-wled-plugin'];

			mockExtensionsBulkService.setEnabled.mockResolvedValue({ succeeded: types, failed: [] });

			const response = await controller.bulkUpdate({ data: { types, enabled: true } } as never);

			expect(mockExtensionsBulkService.setEnabled).toHaveBeenCalledTimes(1);
			expect(mockExtensionsBulkService.setEnabled).toHaveBeenCalledWith(types, true);
			expect(response.data.succeeded).toEqual(types);
		});

		it('reports a refusal in the response rather than throwing', async () => {
			mockExtensionsBulkService.setEnabled.mockResolvedValue({
				succeeded: ['devices-wled-plugin'],
				failed: [{ id: 'devices-module', reason: 'Extension devices-module is not configurable' }],
			});

			const response = await controller.bulkUpdate({
				data: { types: ['devices-wled-plugin', 'devices-module'], enabled: false },
			} as never);

			expect(response.data.failed).toEqual([
				{ id: 'devices-module', reason: 'Extension devices-module is not configurable' },
			]);
		});
	});
});
