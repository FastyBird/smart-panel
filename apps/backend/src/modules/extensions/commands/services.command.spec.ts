/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Test, TestingModule } from '@nestjs/testing';

import { ServiceStatusExtended } from '../services/managed-extension-service.interface';
import { ManagedServiceManagerService } from '../services/managed-service-manager.service';

import {
	ListServicesCommand,
	RestartServiceCommand,
	StartServiceCommand,
	StopServiceCommand,
} from './services.command';

describe('Services Commands', () => {
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

	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
		jest.restoreAllMocks();
	});

	describe('ListServicesCommand', () => {
		let command: ListServicesCommand;

		beforeEach(async () => {
			const module: TestingModule = await Test.createTestingModule({
				providers: [
					ListServicesCommand,
					{
						provide: ManagedServiceManagerService,
						useValue: {
							getStatus: jest.fn(),
						},
					},
				],
			}).compile();

			command = module.get<ListServicesCommand>(ListServicesCommand);
			managedServiceManager = module.get(ManagedServiceManagerService);
		});

		it('should list all services', async () => {
			const mockStatuses = [
				createMockServiceStatus({ extensionType: 'plugin-1', serviceId: 'main' }),
				createMockServiceStatus({ extensionType: 'plugin-2', serviceId: 'discovery', state: 'stopped' }),
			];
			managedServiceManager.getStatus.mockResolvedValue(mockStatuses);

			await command.run([], {});

			expect(managedServiceManager.getStatus).toHaveBeenCalled();
			expect(console.log).toHaveBeenCalled();
		});

		it('should handle empty services list', async () => {
			managedServiceManager.getStatus.mockResolvedValue([]);

			await command.run([], {});

			expect(managedServiceManager.getStatus).toHaveBeenCalled();
		});
	});

	describe('StartServiceCommand', () => {
		let command: StartServiceCommand;

		beforeEach(async () => {
			const module: TestingModule = await Test.createTestingModule({
				providers: [
					StartServiceCommand,
					{
						provide: ManagedServiceManagerService,
						useValue: {
							isRegistered: jest.fn(),
							startServiceManually: jest.fn(),
							getServiceStatus: jest.fn(),
						},
					},
				],
			}).compile();

			command = module.get<StartServiceCommand>(StartServiceCommand);
			managedServiceManager = module.get(ManagedServiceManagerService);
		});

		it('should start a registered service', async () => {
			managedServiceManager.isRegistered.mockReturnValue(true);
			managedServiceManager.startServiceManually.mockResolvedValue(true);

			await command.run(['plugin', 'devices-shelly-v1', 'main'], {});

			expect(managedServiceManager.isRegistered).toHaveBeenCalledWith('plugin', 'devices-shelly-v1', 'main');
			expect(managedServiceManager.startServiceManually).toHaveBeenCalledWith('plugin', 'devices-shelly-v1', 'main');
		});

		it('should handle service already started', async () => {
			const mockStatus = createMockServiceStatus({ state: 'started' });
			managedServiceManager.isRegistered.mockReturnValue(true);
			managedServiceManager.startServiceManually.mockResolvedValue(false);
			managedServiceManager.getServiceStatus.mockResolvedValue(mockStatus);

			await command.run(['plugin', 'devices-shelly-v1', 'main'], {});

			expect(managedServiceManager.getServiceStatus).toHaveBeenCalledWith('plugin', 'devices-shelly-v1', 'main');
			expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to start service'));
		});

		it('should exit with error for unregistered service', async () => {
			const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
			managedServiceManager.isRegistered.mockReturnValue(false);

			await command.run(['plugin', 'unknown', 'service'], {});

			expect(mockExit).toHaveBeenCalledWith(1);
			mockExit.mockRestore();
		});

		it('should exit with error when missing arguments', async () => {
			const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

			await command.run([], {});

			expect(mockExit).toHaveBeenCalledWith(1);
			mockExit.mockRestore();
		});
	});

	describe('StopServiceCommand', () => {
		let command: StopServiceCommand;

		beforeEach(async () => {
			const module: TestingModule = await Test.createTestingModule({
				providers: [
					StopServiceCommand,
					{
						provide: ManagedServiceManagerService,
						useValue: {
							isRegistered: jest.fn(),
							stopServiceManually: jest.fn(),
							getServiceStatus: jest.fn(),
						},
					},
				],
			}).compile();

			command = module.get<StopServiceCommand>(StopServiceCommand);
			managedServiceManager = module.get(ManagedServiceManagerService);
		});

		it('should stop a registered service', async () => {
			managedServiceManager.isRegistered.mockReturnValue(true);
			managedServiceManager.stopServiceManually.mockResolvedValue(true);

			await command.run(['plugin', 'devices-shelly-v1', 'main'], {});

			expect(managedServiceManager.isRegistered).toHaveBeenCalledWith('plugin', 'devices-shelly-v1', 'main');
			expect(managedServiceManager.stopServiceManually).toHaveBeenCalledWith('plugin', 'devices-shelly-v1', 'main');
		});

		it('should handle service already stopped', async () => {
			const mockStatus = createMockServiceStatus({ state: 'stopped' });
			managedServiceManager.isRegistered.mockReturnValue(true);
			managedServiceManager.stopServiceManually.mockResolvedValue(false);
			managedServiceManager.getServiceStatus.mockResolvedValue(mockStatus);

			await command.run(['plugin', 'devices-shelly-v1', 'main'], {});

			expect(managedServiceManager.getServiceStatus).toHaveBeenCalledWith('plugin', 'devices-shelly-v1', 'main');
			expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to stop service'));
		});
	});

	describe('RestartServiceCommand', () => {
		let command: RestartServiceCommand;

		beforeEach(async () => {
			const module: TestingModule = await Test.createTestingModule({
				providers: [
					RestartServiceCommand,
					{
						provide: ManagedServiceManagerService,
						useValue: {
							isRegistered: jest.fn(),
							restartService: jest.fn(),
							getServiceStatus: jest.fn(),
						},
					},
				],
			}).compile();

			command = module.get<RestartServiceCommand>(RestartServiceCommand);
			managedServiceManager = module.get(ManagedServiceManagerService);
		});

		it('should restart a registered service', async () => {
			managedServiceManager.isRegistered.mockReturnValue(true);
			managedServiceManager.restartService.mockResolvedValue(true);

			await command.run(['plugin', 'devices-shelly-v1', 'main'], {});

			expect(managedServiceManager.isRegistered).toHaveBeenCalledWith('plugin', 'devices-shelly-v1', 'main');
			expect(managedServiceManager.restartService).toHaveBeenCalledWith('plugin', 'devices-shelly-v1', 'main');
		});

		it('should handle restart failure due to disabled plugin', async () => {
			const mockStatus = createMockServiceStatus({ state: 'stopped', desiredState: 'stopped', enabled: false });
			managedServiceManager.isRegistered.mockReturnValue(true);
			managedServiceManager.restartService.mockResolvedValue(false);
			managedServiceManager.getServiceStatus.mockResolvedValue(mockStatus);

			await command.run(['plugin', 'devices-shelly-v1', 'main'], {});

			expect(managedServiceManager.getServiceStatus).toHaveBeenCalledWith('plugin', 'devices-shelly-v1', 'main');
			expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Cannot restart'));
		});
	});
});
