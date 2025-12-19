/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Logger, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ServiceStatusExtended } from '../services/managed-plugin-service.interface';
import { PluginServiceManagerService } from '../services/plugin-service-manager.service';

import { ServicesController } from './services.controller';

describe('ServicesController', () => {
	let controller: ServicesController;
	let pluginServiceManager: jest.Mocked<PluginServiceManagerService>;

	const createMockServiceStatus = (overrides: Partial<ServiceStatusExtended> = {}): ServiceStatusExtended => ({
		pluginName: 'devices-shelly-v1',
		serviceId: 'main',
		state: 'started',
		enabled: true,
		healthy: true,
		lastStartedAt: '2025-01-15T10:00:00.000Z',
		lastStoppedAt: undefined,
		lastError: undefined,
		startCount: 3,
		uptimeMs: 3600000,
		...overrides,
	});

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [ServicesController],
			providers: [
				{
					provide: PluginServiceManagerService,
					useValue: {
						getStatus: jest.fn(),
						getServiceStatus: jest.fn(),
						startServiceManually: jest.fn(),
						stopServiceManually: jest.fn(),
						restartService: jest.fn(),
					},
				},
			],
		}).compile();

		controller = module.get<ServicesController>(ServicesController);
		pluginServiceManager = module.get(PluginServiceManagerService);

		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('findAll', () => {
		it('should return all service statuses', async () => {
			const mockStatuses = [
				createMockServiceStatus({ pluginName: 'devices-shelly-v1', serviceId: 'main' }),
				createMockServiceStatus({
					pluginName: 'devices-shelly-ng',
					serviceId: 'main',
					state: 'stopped',
					enabled: false,
				}),
			];
			pluginServiceManager.getStatus.mockResolvedValue(mockStatuses);

			const result = await controller.findAll();

			expect(result.data).toHaveLength(2);
			expect(pluginServiceManager.getStatus).toHaveBeenCalled();
		});

		it('should return empty array when no services', async () => {
			pluginServiceManager.getStatus.mockResolvedValue([]);

			const result = await controller.findAll();

			expect(result.data).toHaveLength(0);
			expect(Array.isArray(result.data)).toBe(true);
		});

		it('should map status fields correctly', async () => {
			const mockStatus = createMockServiceStatus({
				pluginName: 'test-plugin',
				serviceId: 'discovery',
				state: 'error',
				lastError: 'Connection refused',
			});
			pluginServiceManager.getStatus.mockResolvedValue([mockStatus]);

			const result = await controller.findAll();

			expect(result.data[0].pluginName).toBe('test-plugin');
			expect(result.data[0].serviceId).toBe('discovery');
			expect(result.data[0].state).toBe('error');
			expect(result.data[0].lastError).toBe('Connection refused');
		});
	});

	describe('findOne', () => {
		it('should return a single service status', () => {
			const mockStatus = createMockServiceStatus();
			pluginServiceManager.getServiceStatus.mockReturnValue(mockStatus);

			const result = controller.findOne('devices-shelly-v1', 'main');

			expect(result.data).toBeDefined();
			expect(result.data.pluginName).toBe('devices-shelly-v1');
			expect(result.data.serviceId).toBe('main');
			expect(pluginServiceManager.getServiceStatus).toHaveBeenCalledWith('devices-shelly-v1', 'main');
		});

		it('should throw NotFoundException when service not found', () => {
			pluginServiceManager.getServiceStatus.mockReturnValue(null);

			expect(() => controller.findOne('unknown-plugin', 'unknown')).toThrow(NotFoundException);
		});
	});

	describe('start', () => {
		it('should start a service and return status', async () => {
			const mockStatus = createMockServiceStatus({ state: 'started' });
			pluginServiceManager.startServiceManually.mockResolvedValue(true);
			pluginServiceManager.getServiceStatus.mockReturnValue(mockStatus);

			const result = await controller.start('devices-shelly-v1', 'main');

			expect(result.data.state).toBe('started');
			expect(pluginServiceManager.startServiceManually).toHaveBeenCalledWith('devices-shelly-v1', 'main');
		});

		it('should return status even if already started', async () => {
			const mockStatus = createMockServiceStatus({ state: 'started' });
			pluginServiceManager.startServiceManually.mockResolvedValue(false);
			pluginServiceManager.getServiceStatus.mockReturnValue(mockStatus);

			const result = await controller.start('devices-shelly-v1', 'main');

			expect(result.data.state).toBe('started');
		});

		it('should throw NotFoundException when service not found', async () => {
			pluginServiceManager.startServiceManually.mockResolvedValue(false);
			pluginServiceManager.getServiceStatus.mockReturnValue(null);

			await expect(controller.start('unknown-plugin', 'unknown')).rejects.toThrow(NotFoundException);
		});
	});

	describe('stop', () => {
		it('should stop a service and return status', async () => {
			const mockStatus = createMockServiceStatus({ state: 'stopped' });
			pluginServiceManager.stopServiceManually.mockResolvedValue(true);
			pluginServiceManager.getServiceStatus.mockReturnValue(mockStatus);

			const result = await controller.stop('devices-shelly-v1', 'main');

			expect(result.data.state).toBe('stopped');
			expect(pluginServiceManager.stopServiceManually).toHaveBeenCalledWith('devices-shelly-v1', 'main');
		});

		it('should return status even if already stopped', async () => {
			const mockStatus = createMockServiceStatus({ state: 'stopped' });
			pluginServiceManager.stopServiceManually.mockResolvedValue(false);
			pluginServiceManager.getServiceStatus.mockReturnValue(mockStatus);

			const result = await controller.stop('devices-shelly-v1', 'main');

			expect(result.data.state).toBe('stopped');
		});

		it('should throw NotFoundException when service not found', async () => {
			pluginServiceManager.stopServiceManually.mockResolvedValue(false);
			pluginServiceManager.getServiceStatus.mockReturnValue(null);

			await expect(controller.stop('unknown-plugin', 'unknown')).rejects.toThrow(NotFoundException);
		});
	});

	describe('restart', () => {
		it('should restart a service and return status', async () => {
			const mockStatus = createMockServiceStatus({ state: 'started' });
			pluginServiceManager.restartService.mockResolvedValue(true);
			pluginServiceManager.getServiceStatus.mockReturnValue(mockStatus);

			const result = await controller.restart('devices-shelly-v1', 'main');

			expect(result.data.state).toBe('started');
			expect(pluginServiceManager.restartService).toHaveBeenCalledWith('devices-shelly-v1', 'main');
		});

		it('should return status even if restart fails', async () => {
			const mockStatus = createMockServiceStatus({ state: 'stopped', enabled: false });
			pluginServiceManager.restartService.mockResolvedValue(false);
			pluginServiceManager.getServiceStatus.mockReturnValue(mockStatus);

			const result = await controller.restart('devices-shelly-v1', 'main');

			expect(result.data.state).toBe('stopped');
			expect(result.data.enabled).toBe(false);
		});

		it('should throw NotFoundException when service not found', async () => {
			pluginServiceManager.restartService.mockResolvedValue(false);
			pluginServiceManager.getServiceStatus.mockReturnValue(null);

			await expect(controller.restart('unknown-plugin', 'unknown')).rejects.toThrow(NotFoundException);
		});
	});
});
