/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ServiceStatusExtended } from '../services/managed-plugin-service.interface';
import { PluginServiceManagerService } from '../services/plugin-service-manager.service';

import { ListServicesCommand, RestartServiceCommand, StartServiceCommand, StopServiceCommand } from './services.command';

describe('Services Commands', () => {
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
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
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
						provide: PluginServiceManagerService,
						useValue: {
							getStatus: jest.fn(),
						},
					},
				],
			}).compile();

			command = module.get<ListServicesCommand>(ListServicesCommand);
			pluginServiceManager = module.get(PluginServiceManagerService);
		});

		it('should list all services', async () => {
			const mockStatuses = [
				createMockServiceStatus({ pluginName: 'plugin-1', serviceId: 'main' }),
				createMockServiceStatus({ pluginName: 'plugin-2', serviceId: 'discovery', state: 'stopped' }),
			];
			pluginServiceManager.getStatus.mockResolvedValue(mockStatuses);

			await command.run([], {});

			expect(pluginServiceManager.getStatus).toHaveBeenCalled();
			expect(console.log).toHaveBeenCalled();
		});

		it('should handle empty services list', async () => {
			pluginServiceManager.getStatus.mockResolvedValue([]);

			await command.run([], {});

			expect(pluginServiceManager.getStatus).toHaveBeenCalled();
		});
	});

	describe('StartServiceCommand', () => {
		let command: StartServiceCommand;

		beforeEach(async () => {
			const module: TestingModule = await Test.createTestingModule({
				providers: [
					StartServiceCommand,
					{
						provide: PluginServiceManagerService,
						useValue: {
							isRegistered: jest.fn(),
							startServiceManually: jest.fn(),
							getServiceStatus: jest.fn(),
						},
					},
				],
			}).compile();

			command = module.get<StartServiceCommand>(StartServiceCommand);
			pluginServiceManager = module.get(PluginServiceManagerService);
		});

		it('should start a registered service', async () => {
			pluginServiceManager.isRegistered.mockReturnValue(true);
			pluginServiceManager.startServiceManually.mockResolvedValue(true);

			await command.run(['devices-shelly-v1', 'main'], {});

			expect(pluginServiceManager.isRegistered).toHaveBeenCalledWith('devices-shelly-v1', 'main');
			expect(pluginServiceManager.startServiceManually).toHaveBeenCalledWith('devices-shelly-v1', 'main');
		});

		it('should handle service already started', async () => {
			const mockStatus = createMockServiceStatus({ state: 'started' });
			pluginServiceManager.isRegistered.mockReturnValue(true);
			pluginServiceManager.startServiceManually.mockResolvedValue(false);
			pluginServiceManager.getServiceStatus.mockReturnValue(mockStatus);

			await command.run(['devices-shelly-v1', 'main'], {});

			expect(pluginServiceManager.getServiceStatus).toHaveBeenCalledWith('devices-shelly-v1', 'main');
		});

		it('should exit with error for unregistered service', async () => {
			const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
			pluginServiceManager.isRegistered.mockReturnValue(false);

			await command.run(['unknown', 'service'], {});

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
						provide: PluginServiceManagerService,
						useValue: {
							isRegistered: jest.fn(),
							stopServiceManually: jest.fn(),
							getServiceStatus: jest.fn(),
						},
					},
				],
			}).compile();

			command = module.get<StopServiceCommand>(StopServiceCommand);
			pluginServiceManager = module.get(PluginServiceManagerService);
		});

		it('should stop a registered service', async () => {
			pluginServiceManager.isRegistered.mockReturnValue(true);
			pluginServiceManager.stopServiceManually.mockResolvedValue(true);

			await command.run(['devices-shelly-v1', 'main'], {});

			expect(pluginServiceManager.isRegistered).toHaveBeenCalledWith('devices-shelly-v1', 'main');
			expect(pluginServiceManager.stopServiceManually).toHaveBeenCalledWith('devices-shelly-v1', 'main');
		});

		it('should handle service already stopped', async () => {
			const mockStatus = createMockServiceStatus({ state: 'stopped' });
			pluginServiceManager.isRegistered.mockReturnValue(true);
			pluginServiceManager.stopServiceManually.mockResolvedValue(false);
			pluginServiceManager.getServiceStatus.mockReturnValue(mockStatus);

			await command.run(['devices-shelly-v1', 'main'], {});

			expect(pluginServiceManager.getServiceStatus).toHaveBeenCalledWith('devices-shelly-v1', 'main');
		});
	});

	describe('RestartServiceCommand', () => {
		let command: RestartServiceCommand;

		beforeEach(async () => {
			const module: TestingModule = await Test.createTestingModule({
				providers: [
					RestartServiceCommand,
					{
						provide: PluginServiceManagerService,
						useValue: {
							isRegistered: jest.fn(),
							restartService: jest.fn(),
							getServiceStatus: jest.fn(),
						},
					},
				],
			}).compile();

			command = module.get<RestartServiceCommand>(RestartServiceCommand);
			pluginServiceManager = module.get(PluginServiceManagerService);
		});

		it('should restart a registered service', async () => {
			pluginServiceManager.isRegistered.mockReturnValue(true);
			pluginServiceManager.restartService.mockResolvedValue(true);

			await command.run(['devices-shelly-v1', 'main'], {});

			expect(pluginServiceManager.isRegistered).toHaveBeenCalledWith('devices-shelly-v1', 'main');
			expect(pluginServiceManager.restartService).toHaveBeenCalledWith('devices-shelly-v1', 'main');
		});

		it('should handle restart failure due to disabled plugin', async () => {
			const mockStatus = createMockServiceStatus({ state: 'stopped', enabled: false });
			pluginServiceManager.isRegistered.mockReturnValue(true);
			pluginServiceManager.restartService.mockResolvedValue(false);
			pluginServiceManager.getServiceStatus.mockReturnValue(mockStatus);

			await command.run(['devices-shelly-v1', 'main'], {});

			expect(pluginServiceManager.getServiceStatus).toHaveBeenCalledWith('devices-shelly-v1', 'main');
		});
	});
});
