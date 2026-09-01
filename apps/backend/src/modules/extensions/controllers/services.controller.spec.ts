/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';

import { ServiceStatusExtended } from '../services/managed-extension-service.interface';
import { ManagedServiceManagerService } from '../services/managed-service-manager.service';

import { ServicesController } from './services.controller';

describe('ServicesController', () => {
	let controller: ServicesController;
	let managedServiceManager: jest.Mocked<ManagedServiceManagerService>;

	const createMockServiceStatus = (overrides: Partial<ServiceStatusExtended> = {}): ServiceStatusExtended => ({
		extensionKind: 'plugin',
		extensionType: 'devices-shelly-v1',
		serviceId: 'main',
		activationPolicy: 'owner-enabled',
		state: 'started',
		desiredState: 'started',
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
					provide: ManagedServiceManagerService,
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
		managedServiceManager = module.get(ManagedServiceManagerService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('routes', () => {
		it('includes extension kind, extension type, and service ID in item and action routes', () => {
			expect(Reflect.getMetadata(PATH_METADATA, ServicesController.prototype.findOne)).toBe(
				':extensionKind/:extensionType/:serviceId',
			);
			expect(Reflect.getMetadata(PATH_METADATA, ServicesController.prototype.start)).toBe(
				':extensionKind/:extensionType/:serviceId/start',
			);
			expect(Reflect.getMetadata(PATH_METADATA, ServicesController.prototype.stop)).toBe(
				':extensionKind/:extensionType/:serviceId/stop',
			);
			expect(Reflect.getMetadata(PATH_METADATA, ServicesController.prototype.restart)).toBe(
				':extensionKind/:extensionType/:serviceId/restart',
			);
		});
	});

	describe('findAll', () => {
		it('should return all service statuses', async () => {
			const mockStatuses = [
				createMockServiceStatus({ extensionType: 'devices-shelly-v1', serviceId: 'main' }),
				createMockServiceStatus({
					extensionType: 'devices-shelly-ng',
					serviceId: 'main',
					state: 'stopped',
					enabled: false,
				}),
			];
			managedServiceManager.getStatus.mockResolvedValue(mockStatuses);

			const result = await controller.findAll();

			expect(result.data).toHaveLength(2);
			expect(managedServiceManager.getStatus).toHaveBeenCalled();
		});

		it('should return empty array when no services', async () => {
			managedServiceManager.getStatus.mockResolvedValue([]);

			const result = await controller.findAll();

			expect(result.data).toHaveLength(0);
			expect(Array.isArray(result.data)).toBe(true);
		});

		it('should map status fields correctly', async () => {
			const mockStatus = createMockServiceStatus({
				extensionType: 'test-plugin',
				serviceId: 'discovery',
				state: 'error',
				lastError: 'Connection refused',
			});
			managedServiceManager.getStatus.mockResolvedValue([mockStatus]);

			const result = await controller.findAll();

			expect(result.data[0].extensionKind).toBe('plugin');
			expect(result.data[0].extensionType).toBe('test-plugin');
			expect(result.data[0].serviceId).toBe('discovery');
			expect(result.data[0].activationPolicy).toBe('owner-enabled');
			expect(result.data[0].state).toBe('error');
			expect(result.data[0].desiredState).toBe('started');
			expect(result.data[0].lastError).toBe('Connection refused');
		});
	});

	describe('findOne', () => {
		it('should return a single service status', async () => {
			const mockStatus = createMockServiceStatus();
			managedServiceManager.getServiceStatus.mockResolvedValue(mockStatus);

			const result = await controller.findOne('plugin', 'devices-shelly-v1', 'main');

			expect(result.data).toBeDefined();
			expect(result.data.extensionType).toBe('devices-shelly-v1');
			expect(result.data.serviceId).toBe('main');
			expect(managedServiceManager.getServiceStatus).toHaveBeenCalledWith('plugin', 'devices-shelly-v1', 'main');
		});

		it('should throw NotFoundException when service not found', async () => {
			managedServiceManager.getServiceStatus.mockResolvedValue(null);

			await expect(controller.findOne('plugin', 'unknown-plugin', 'unknown')).rejects.toThrow(NotFoundException);
		});
	});

	describe('start', () => {
		it('should start a service and return status', async () => {
			const mockStatus = createMockServiceStatus({ state: 'started' });
			managedServiceManager.startServiceManually.mockResolvedValue(true);
			managedServiceManager.getServiceStatus.mockResolvedValue(mockStatus);

			const result = await controller.start('plugin', 'devices-shelly-v1', 'main');

			expect(result.data.state).toBe('started');
			expect(managedServiceManager.startServiceManually).toHaveBeenCalledWith('plugin', 'devices-shelly-v1', 'main');
		});

		it('should throw BadRequestException when start does not achieve the requested state', async () => {
			const mockStatus = createMockServiceStatus({ state: 'started' });
			managedServiceManager.startServiceManually.mockResolvedValue(false);
			managedServiceManager.getServiceStatus.mockResolvedValue(mockStatus);

			await expect(controller.start('plugin', 'devices-shelly-v1', 'main')).rejects.toThrow(BadRequestException);
		});

		it('should throw NotFoundException when service not found', async () => {
			managedServiceManager.startServiceManually.mockResolvedValue(false);
			managedServiceManager.getServiceStatus.mockResolvedValue(null);

			await expect(controller.start('plugin', 'unknown-plugin', 'unknown')).rejects.toThrow(NotFoundException);
		});
	});

	describe('stop', () => {
		it('should stop a service and return status', async () => {
			const mockStatus = createMockServiceStatus({ state: 'stopped' });
			managedServiceManager.stopServiceManually.mockResolvedValue(true);
			managedServiceManager.getServiceStatus.mockResolvedValue(mockStatus);

			const result = await controller.stop('plugin', 'devices-shelly-v1', 'main');

			expect(result.data.state).toBe('stopped');
			expect(managedServiceManager.stopServiceManually).toHaveBeenCalledWith('plugin', 'devices-shelly-v1', 'main');
		});

		it('should throw BadRequestException when stop does not achieve the requested state', async () => {
			const mockStatus = createMockServiceStatus({ state: 'stopped' });
			managedServiceManager.stopServiceManually.mockResolvedValue(false);
			managedServiceManager.getServiceStatus.mockResolvedValue(mockStatus);

			await expect(controller.stop('plugin', 'devices-shelly-v1', 'main')).rejects.toThrow(BadRequestException);
		});

		it('should throw NotFoundException when service not found', async () => {
			managedServiceManager.stopServiceManually.mockResolvedValue(false);
			managedServiceManager.getServiceStatus.mockResolvedValue(null);

			await expect(controller.stop('plugin', 'unknown-plugin', 'unknown')).rejects.toThrow(NotFoundException);
		});
	});

	describe('restart', () => {
		it('should restart a service and return status', async () => {
			const mockStatus = createMockServiceStatus({ state: 'started' });
			managedServiceManager.restartService.mockResolvedValue(true);
			managedServiceManager.getServiceStatus.mockResolvedValue(mockStatus);

			const result = await controller.restart('plugin', 'devices-shelly-v1', 'main');

			expect(result.data.state).toBe('started');
			expect(managedServiceManager.restartService).toHaveBeenCalledWith('plugin', 'devices-shelly-v1', 'main');
		});

		it('should throw BadRequestException when restart fails', async () => {
			const mockStatus = createMockServiceStatus({ state: 'stopped', enabled: false });
			managedServiceManager.restartService.mockResolvedValue(false);
			managedServiceManager.getServiceStatus.mockResolvedValue(mockStatus);

			await expect(controller.restart('plugin', 'devices-shelly-v1', 'main')).rejects.toThrow(BadRequestException);
		});

		it('should throw NotFoundException when service not found', async () => {
			managedServiceManager.restartService.mockResolvedValue(false);
			managedServiceManager.getServiceStatus.mockResolvedValue(null);

			await expect(controller.restart('plugin', 'unknown-plugin', 'unknown')).rejects.toThrow(NotFoundException);
		});
	});
});
