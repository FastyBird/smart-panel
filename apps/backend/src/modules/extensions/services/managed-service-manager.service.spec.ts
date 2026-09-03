import { ConfigService as NestConfigService } from '@nestjs/config';

import { ConfigService } from '../../config/services/config.service';
import { PluginConfigValidatorService } from '../../config/services/plugin-config-validator.service';
import {
	NotificationActionType,
	NotificationKind,
	NotificationSeverity,
} from '../../notifications/notifications.constants';
import { NotificationsService } from '../../notifications/services/notifications.service';

import {
	IManagedExtensionService,
	ManagedServiceActivationPolicy,
	ManagedServiceOwnerKind,
	ServiceState,
} from './managed-extension-service.interface';
import { ManagedServiceManagerService } from './managed-service-manager.service';

/**
 * Minimal mock service whose state can be controlled externally.
 */
function createMockService(
	ownerKind: ManagedServiceOwnerKind,
	ownerType: string,
	serviceId: string,
	initialState: ServiceState = 'stopped',
	activationPolicy: ManagedServiceActivationPolicy = 'owner-enabled',
): IManagedExtensionService & { _state: ServiceState } {
	const svc: IManagedExtensionService & { _state: ServiceState } = {
		owner: { kind: ownerKind, type: ownerType },
		serviceId,
		activationPolicy,
		_state: initialState,
		start: jest.fn(() => {
			svc._state = 'started';

			return Promise.resolve();
		}),
		stop: jest.fn(() => {
			svc._state = 'stopped';

			return Promise.resolve();
		}),
		getState: jest.fn(() => svc._state),
	};

	return svc;
}

describe('ManagedServiceManagerService', () => {
	let manager: ManagedServiceManagerService;
	let configService: { getModuleConfig: jest.Mock; getPluginConfig: jest.Mock };
	let nestConfigService: { get: jest.Mock };
	let pluginConfigValidator: { hasValidator: jest.Mock; validate: jest.Mock };
	let notifications: { notify: jest.Mock; resolve: jest.Mock; resolveAll: jest.Mock };

	beforeEach(() => {
		jest.useFakeTimers();

		configService = {
			getModuleConfig: jest.fn().mockReturnValue({ enabled: true }),
			getPluginConfig: jest.fn().mockReturnValue({ enabled: true }),
		};

		nestConfigService = {
			get: jest.fn().mockReturnValue(null), // not CLI mode
		};

		pluginConfigValidator = {
			hasValidator: jest.fn().mockReturnValue(false),
			validate: jest.fn().mockResolvedValue({ valid: true }),
		};

		notifications = { notify: jest.fn(), resolve: jest.fn(), resolveAll: jest.fn() };

		manager = new ManagedServiceManagerService(
			configService as unknown as ConfigService,
			nestConfigService as unknown as NestConfigService,
			pluginConfigValidator as unknown as PluginConfigValidatorService,
			notifications as unknown as NotificationsService,
		);

		// Mark startup as complete so handleConfigUpdated processes events
		(manager as unknown as { startupComplete: boolean }).startupComplete = true;
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('extension ownership and activation', () => {
		it('registers module and plugin services under distinct authoritative keys', () => {
			manager.register(createMockService('module', 'shared-owner', 'runtime'));
			manager.register(createMockService('plugin', 'shared-owner', 'runtime'));

			expect(manager.getRegisteredServices()).toEqual(['module:shared-owner:runtime', 'plugin:shared-owner:runtime']);
		});

		it('keeps the complete managed runtime inventory explicit', () => {
			const expectedKeys = [
				'plugin:devices-home-assistant-plugin:connector',
				'plugin:devices-home-assistant-plugin:discovery',
				'plugin:devices-homey-plugin:connector',
				'plugin:devices-reterminal-plugin:connector',
				'plugin:devices-shelly-ng-plugin:connector',
				'plugin:devices-shelly-v1-plugin:connector',
				'plugin:devices-wled-plugin:connector',
				'plugin:devices-zigbee2mqtt-plugin:connector',
				'plugin:buddy-discord-plugin:bot',
				'plugin:buddy-telegram-plugin:bot',
				'plugin:buddy-whatsapp-plugin:bot',
				'plugin:influx-v1-plugin:storage',
				'plugin:influx-v2-plugin:storage',
				'plugin:memory-storage-plugin:storage',
				'plugin:logger-rotating-file-plugin:file-logger',
				'plugin:simulator-plugin:simulation',
				'module:mdns-module:advertisement',
				'module:buddy-module:heartbeat',
				'module:weather-module:refresh',
				'plugin:spaces-home-control-plugin:suggestion-heartbeat',
			];

			for (const key of expectedKeys) {
				const [kind, type, serviceId] = key.split(':') as ['module' | 'plugin', string, string];
				manager.register(createMockService(kind, type, serviceId));
			}

			expect(manager.getRegisteredServices()).toEqual(expectedKeys);
			expect(expectedKeys).toHaveLength(20);
		});

		it('rejects a duplicate registration with the same owner key', () => {
			const first = createMockService('plugin', 'duplicate-owner', 'runtime');
			const duplicate = createMockService('plugin', 'duplicate-owner', 'runtime');

			manager.register(first);

			expect(() => manager.register(duplicate)).toThrow('Service already registered: plugin:duplicate-owner:runtime');
		});

		it('starts always-active services while reporting the disabled owner separately', async () => {
			configService.getPluginConfig.mockReturnValue({ enabled: false });
			const service = createMockService('plugin', 'discovery-owner', 'discovery', 'stopped', 'always');
			(manager as unknown as { startupComplete: boolean }).startupComplete = false;
			manager.register(service);

			await manager.onApplicationBootstrap();

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).toHaveBeenCalledTimes(1);
			await expect(manager.getServiceStatus('plugin', 'discovery-owner', 'discovery')).resolves.toEqual(
				expect.objectContaining({
					activationPolicy: 'always',
					desiredState: 'started',
					enabled: false,
					state: 'started',
				}),
			);
		});

		it('routes plugin and module config events only to matching owners', async () => {
			const pluginService = createMockService('plugin', 'shared-owner', 'runtime');
			const moduleService = createMockService('module', 'shared-owner', 'runtime');

			(manager as unknown as { startupComplete: boolean }).startupComplete = false;
			manager.register(pluginService);
			manager.register(moduleService);
			(manager as unknown as { startupComplete: boolean }).startupComplete = true;
			await manager.handleConfigUpdated({ source: 'shared-owner', type: 'plugin' });

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(pluginService.start).toHaveBeenCalledTimes(1);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(moduleService.start).not.toHaveBeenCalled();

			await manager.handleConfigUpdated({ source: 'shared-owner', type: 'module' });

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(moduleService.start).toHaveBeenCalledTimes(1);
			expect(configService.getPluginConfig).toHaveBeenCalledWith('shared-owner');
			expect(configService.getModuleConfig).toHaveBeenCalledWith('shared-owner');
		});

		it('does not route non-matching config events', async () => {
			const service = createMockService('module', 'target-module', 'runtime');

			(manager as unknown as { startupComplete: boolean }).startupComplete = false;
			manager.register(service);
			(manager as unknown as { startupComplete: boolean }).startupComplete = true;
			await manager.handleConfigUpdated({ source: 'other-module', type: 'module' });
			await manager.handleConfigUpdated({ source: 'target-module', type: 'plugin' });

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).not.toHaveBeenCalled();
		});

		it('blocks manual start and restart when an owner-enabled service owner is disabled', async () => {
			configService.getModuleConfig.mockReturnValue({ enabled: false });
			const service = createMockService('module', 'disabled-module', 'runtime');

			manager.register(service);

			await expect(manager.startServiceManually('module', 'disabled-module', 'runtime')).resolves.toBe(false);
			await expect(manager.restartService('module', 'disabled-module', 'runtime')).resolves.toBe(false);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).not.toHaveBeenCalled();
			await expect(manager.getServiceStatus('module', 'disabled-module', 'runtime')).resolves.toEqual(
				expect.objectContaining({ enabled: false, desiredState: 'stopped' }),
			);
		});

		it('allows manual restart for an always-active service with a disabled owner', async () => {
			configService.getPluginConfig.mockReturnValue({ enabled: false });
			const service = createMockService('plugin', 'discovery-owner', 'discovery', 'started', 'always');

			manager.register(service);

			await expect(manager.restartService('plugin', 'discovery-owner', 'discovery')).resolves.toBe(true);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.stop).toHaveBeenCalledTimes(1);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).toHaveBeenCalledTimes(1);
		});

		it('does not validate module services with plugin validators', async () => {
			pluginConfigValidator.hasValidator.mockReturnValue(true);
			const service = createMockService('module', 'validated-module', 'runtime');

			(manager as unknown as { startupComplete: boolean }).startupComplete = false;
			manager.register(service);
			(manager as unknown as { startupComplete: boolean }).startupComplete = true;
			await manager.handleConfigUpdated({ source: 'validated-module', type: 'module' });

			expect(pluginConfigValidator.hasValidator).not.toHaveBeenCalled();
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).toHaveBeenCalledTimes(1);
		});
	});

	describe('manual action results', () => {
		it('rejects duplicate starts and stopped restarts but stops a starting service', async () => {
			const starting = createMockService('plugin', 'action-plugin', 'starting', 'starting');
			const stopped = createMockService('plugin', 'action-plugin', 'stopped');

			(manager as unknown as { startupComplete: boolean }).startupComplete = false;
			manager.register(starting);
			manager.register(stopped);
			(manager as unknown as { startupComplete: boolean }).startupComplete = true;

			await expect(manager.startServiceManually('plugin', 'action-plugin', 'starting')).resolves.toBe(false);
			await expect(manager.stopServiceManually('plugin', 'action-plugin', 'starting')).resolves.toBe(true);
			expect(starting.getState()).toBe('stopped');
			await expect(manager.restartService('plugin', 'action-plugin', 'stopped')).resolves.toBe(false);
		});

		it('accepts starting as a successful asynchronous launch state', async () => {
			const startedManually = createMockService('plugin', 'action-plugin', 'async-start');
			startedManually.start = jest.fn(() => {
				startedManually._state = 'starting';

				return Promise.resolve();
			});
			const restarted = createMockService('plugin', 'action-plugin', 'async-restart', 'started');
			restarted.start = jest.fn(() => {
				restarted._state = 'starting';

				return Promise.resolve();
			});

			(manager as unknown as { startupComplete: boolean }).startupComplete = false;
			manager.register(startedManually);
			manager.register(restarted);
			(manager as unknown as { startupComplete: boolean }).startupComplete = true;

			await expect(manager.startServiceManually('plugin', 'action-plugin', 'async-start')).resolves.toBe(true);
			await expect(manager.restartService('plugin', 'action-plugin', 'async-restart')).resolves.toBe(true);
			expect(startedManually.getState()).toBe('starting');
			expect(restarted.getState()).toBe('starting');
		});

		it('returns false when start does not reach a valid launch state', async () => {
			const service = createMockService('plugin', 'action-plugin', 'start-failure');
			service.start = jest.fn().mockRejectedValue(new Error('start failed'));

			(manager as unknown as { startupComplete: boolean }).startupComplete = false;
			manager.register(service);
			(manager as unknown as { startupComplete: boolean }).startupComplete = true;

			await expect(manager.startServiceManually('plugin', 'action-plugin', 'start-failure')).resolves.toBe(false);
			expect(service.getState()).toBe('stopped');
		});

		it('returns false when stop does not reach the stopped state', async () => {
			const service = createMockService('plugin', 'action-plugin', 'stop-failure', 'started');
			service.stop = jest.fn().mockRejectedValue(new Error('stop failed'));

			manager.register(service);

			await expect(manager.stopServiceManually('plugin', 'action-plugin', 'stop-failure')).resolves.toBe(false);
			expect(service.getState()).toBe('started');
		});

		it('returns false and does not start when restart cannot stop the service', async () => {
			const service = createMockService('plugin', 'action-plugin', 'restart-stop-failure', 'started');
			service.stop = jest.fn().mockRejectedValue(new Error('stop failed'));

			manager.register(service);

			await expect(manager.restartService('plugin', 'action-plugin', 'restart-stop-failure')).resolves.toBe(false);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).not.toHaveBeenCalled();
		});

		it('returns false when restart cannot reach a valid launch state', async () => {
			const service = createMockService('plugin', 'action-plugin', 'restart-start-failure', 'started');
			service.start = jest.fn().mockRejectedValue(new Error('start failed'));

			manager.register(service);

			await expect(manager.restartService('plugin', 'action-plugin', 'restart-start-failure')).resolves.toBe(false);
			expect(service.getState()).toBe('stopped');
		});
	});

	describe('service error notifications', () => {
		it('raises the service issue on start failure and resolves it once the service starts', async () => {
			const service = createMockService('plugin', 'flaky-plugin', 'runtime');
			service.start = jest
				.fn()
				.mockRejectedValueOnce(new Error('connection refused'))
				.mockRejectedValueOnce(new Error('connection refused again'))
				.mockImplementationOnce(() => {
					service._state = 'started';

					return Promise.resolve();
				});

			manager.register(service);

			// First failure: a fresh transition into error - raises exactly once.
			await expect(manager.startServiceManually('plugin', 'flaky-plugin', 'runtime')).resolves.toBe(false);
			// Second failure: still in error - a retry tick, not a new transition, so no re-raise.
			await expect(manager.startServiceManually('plugin', 'flaky-plugin', 'runtime')).resolves.toBe(false);
			// Recovers: resolves the issue.
			await expect(manager.startServiceManually('plugin', 'flaky-plugin', 'runtime')).resolves.toBe(true);

			expect(notifications.notify).toHaveBeenCalledTimes(1);
			expect(notifications.notify).toHaveBeenCalledWith({
				source: 'flaky-plugin',
				kind: NotificationKind.ISSUE,
				key: 'service:plugin:flaky-plugin:runtime',
				severity: NotificationSeverity.ERROR,
				title: 'Service runtime of flaky-plugin failed',
				message: 'connection refused',
				actions: [
					{
						type: NotificationActionType.SERVICE,
						label: 'Restart service',
						extension_kind: 'plugin',
						extension_type: 'flaky-plugin',
						service_id: 'runtime',
						operation: 'restart',
						primary: true,
					},
					{
						type: NotificationActionType.LINK,
						label: 'Open services',
						url: '/extensions?tab=services&kind=plugin',
					},
				],
			});

			expect(notifications.resolve).toHaveBeenCalledTimes(1);
			expect(notifications.resolve).toHaveBeenCalledWith('flaky-plugin', 'service:plugin:flaky-plugin:runtime');
		});

		it('raises the service issue once readiness retries are exhausted', async () => {
			const service = createMockService('plugin', 'devices-provider', 'connector');

			pluginConfigValidator.hasValidator.mockReturnValue(true);
			pluginConfigValidator.validate.mockResolvedValue({
				valid: false,
				errors: [{ message: 'Configuration validation failed unexpectedly' }],
				transient: true,
			});
			manager.register(service);

			await manager.handleConfigUpdated();
			await jest.advanceTimersByTimeAsync(120_000);

			expect(notifications.notify).toHaveBeenCalledTimes(1);
			expect(notifications.notify).toHaveBeenCalledWith(
				expect.objectContaining({
					source: 'devices-provider',
					kind: NotificationKind.ISSUE,
					key: 'service:plugin:devices-provider:connector',
					severity: NotificationSeverity.ERROR,
					message: 'Configuration readiness check is temporarily unavailable',
				}),
			);
		});
	});

	describe('ordering and lifecycle boundaries', () => {
		it('starts dependencies first using generic service keys', async () => {
			const order: string[] = [];
			const dependency = createMockService('module', 'runtime-module', 'dependency');
			const dependent = createMockService('plugin', 'runtime-plugin', 'dependent');
			dependency.start = jest.fn(() => {
				order.push('dependency');
				dependency._state = 'started';

				return Promise.resolve();
			});
			dependent.start = jest.fn(() => {
				order.push('dependent');
				dependent._state = 'started';

				return Promise.resolve();
			});
			dependent.getDependencies = () => ['module:runtime-module:dependency'];

			(manager as unknown as { startupComplete: boolean }).startupComplete = false;
			manager.register(dependent);
			manager.register(dependency);
			await manager.onApplicationBootstrap();

			expect(order).toEqual(['dependency', 'dependent']);
		});

		it('does not start managed runtimes in CLI mode', async () => {
			const cliConfig = { get: jest.fn().mockReturnValue('on') };
			const cliManager = new ManagedServiceManagerService(
				configService as unknown as ConfigService,
				cliConfig as unknown as NestConfigService,
				pluginConfigValidator as unknown as PluginConfigValidatorService,
				notifications as unknown as NotificationsService,
			);
			const service = createMockService('plugin', 'cli-plugin', 'runtime');

			cliManager.register(service);
			await cliManager.onApplicationBootstrap();

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).not.toHaveBeenCalled();
		});

		it('stops services in reverse dependency order on shutdown', async () => {
			const order: string[] = [];
			const dependency = createMockService('module', 'runtime-module', 'dependency', 'started');
			const dependent = createMockService('plugin', 'runtime-plugin', 'dependent', 'started');
			dependency.stop = jest.fn(() => {
				order.push('dependency');
				dependency._state = 'stopped';

				return Promise.resolve();
			});
			dependent.stop = jest.fn(() => {
				order.push('dependent');
				dependent._state = 'stopped';

				return Promise.resolve();
			});
			dependent.getDependencies = () => ['module:runtime-module:dependency'];

			manager.register(dependent);
			manager.register(dependency);
			await manager.onModuleDestroy();

			expect(order).toEqual(['dependent', 'dependency']);
		});

		it('stops every running service for factory reset and remains reusable', async () => {
			const service = createMockService('module', 'reset-module', 'runtime', 'started');

			manager.register(service);
			await manager.stopAllServices();

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.stop).toHaveBeenCalledTimes(1);
			configService.getModuleConfig.mockReturnValue({ enabled: true });
			await manager.handleConfigUpdated({ source: 'reset-module', type: 'module' });
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).toHaveBeenCalledTimes(1);
		});
	});

	describe('syncServiceState with timed-out transitional states', () => {
		it('keeps an enabled service stopped when its runtime configuration needs attention', async () => {
			const service = createMockService('plugin', 'devices-provider', 'connector');

			pluginConfigValidator.hasValidator.mockReturnValue(true);
			pluginConfigValidator.validate.mockResolvedValue({
				valid: false,
				errors: [{ message: 'API key is required', field: 'api_key' }],
			});
			manager.register(service);

			await manager.handleConfigUpdated();

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).not.toHaveBeenCalled();
			expect(service.getState()).toBe('stopped');
			await expect(manager.getServiceStatus('plugin', 'devices-provider', 'connector')).resolves.toEqual(
				expect.objectContaining({
					state: 'stopped',
					lastError: 'Config validation failed: API key is required',
				}),
			);
		});

		it('keeps an enabled service stopped when its readiness check is temporarily unavailable', async () => {
			const service = createMockService('plugin', 'devices-provider', 'connector');

			pluginConfigValidator.hasValidator.mockReturnValue(true);
			pluginConfigValidator.validate.mockRejectedValue(new Error('private storage failure'));
			manager.register(service);

			await manager.handleConfigUpdated();

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).not.toHaveBeenCalled();
			await expect(manager.getServiceStatus('plugin', 'devices-provider', 'connector')).resolves.toEqual(
				expect.objectContaining({
					state: 'stopped',
					lastError: 'Configuration readiness check is temporarily unavailable',
				}),
			);
		});

		it('retries a transient readiness failure and starts after recovery', async () => {
			const service = createMockService('plugin', 'devices-provider', 'connector');

			pluginConfigValidator.hasValidator.mockReturnValue(true);
			pluginConfigValidator.validate
				.mockResolvedValueOnce({
					valid: false,
					errors: [{ message: 'Configuration validation failed unexpectedly' }],
					transient: true,
				})
				.mockResolvedValue({ valid: true });
			manager.register(service);

			await manager.handleConfigUpdated();
			await jest.advanceTimersByTimeAsync(15_000);

			expect(pluginConfigValidator.validate).toHaveBeenCalledTimes(2);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).toHaveBeenCalledTimes(1);
			await expect(manager.getServiceStatus('plugin', 'devices-provider', 'connector')).resolves.toEqual(
				expect.objectContaining({ state: 'started', lastError: undefined }),
			);
		});

		it('bounds automatic retries for a persistent readiness failure', async () => {
			const service = createMockService('plugin', 'devices-provider', 'connector');

			pluginConfigValidator.hasValidator.mockReturnValue(true);
			pluginConfigValidator.validate.mockResolvedValue({
				valid: false,
				errors: [{ message: 'Configuration validation failed unexpectedly' }],
				transient: true,
			});
			manager.register(service);

			await manager.handleConfigUpdated();
			await jest.advanceTimersByTimeAsync(120_000);

			expect(pluginConfigValidator.validate).toHaveBeenCalledTimes(4);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).not.toHaveBeenCalled();
			expect(jest.getTimerCount()).toBe(0);
		});

		it('cancels a pending readiness retry when the plugin is disabled', async () => {
			const service = createMockService('plugin', 'devices-provider', 'connector');

			pluginConfigValidator.hasValidator.mockReturnValue(true);
			pluginConfigValidator.validate.mockResolvedValue({
				valid: false,
				errors: [{ message: 'Configuration validation failed unexpectedly' }],
				transient: true,
			});
			manager.register(service);

			await manager.handleConfigUpdated();
			configService.getPluginConfig.mockReturnValue({ enabled: false });
			await manager.handleConfigUpdated();
			await jest.advanceTimersByTimeAsync(120_000);

			expect(pluginConfigValidator.validate).toHaveBeenCalledTimes(1);
			expect(jest.getTimerCount()).toBe(0);
		});

		it('does not start when the plugin is disabled during an asynchronous readiness check', async () => {
			const service = createMockService('plugin', 'devices-provider', 'connector');
			let finishValidation = (_result: { valid: boolean }): void => undefined;
			const validation = new Promise<{ valid: boolean }>((resolve) => {
				finishValidation = resolve;
			});

			pluginConfigValidator.hasValidator.mockReturnValue(true);
			pluginConfigValidator.validate.mockReturnValue(validation);
			manager.register(service);

			const start = manager.handleConfigUpdated();
			await Promise.resolve();
			configService.getPluginConfig.mockReturnValue({ enabled: false });
			await manager.handleConfigUpdated();
			finishValidation({ valid: true });
			await start;

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).not.toHaveBeenCalled();
			expect(service.getState()).toBe('stopped');
		});

		it('should force-stop a service stuck in starting state when plugin is disabled', async () => {
			// Create a service that stays in 'starting' (simulates WhatsApp QR scan)
			const service = createMockService('plugin', 'buddy-whatsapp', 'bot', 'starting');

			manager.register(service);

			// Plugin is now disabled
			configService.getPluginConfig.mockReturnValue({ enabled: false });

			const promise = manager.handleConfigUpdated();

			// Advance past the waitForState timeout (10s default, polled every 50ms)
			await jest.advanceTimersByTimeAsync(11_000);

			await promise;

			// The manager should have called stop() to force the service down
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.stop).toHaveBeenCalled();
		});

		it('should not force-stop a service in starting state when plugin is enabled', async () => {
			const service = createMockService('plugin', 'buddy-whatsapp', 'bot', 'starting');

			manager.register(service);

			// Plugin is enabled
			configService.getPluginConfig.mockReturnValue({ enabled: true });

			const promise = manager.handleConfigUpdated();

			await jest.advanceTimersByTimeAsync(11_000);

			await promise;

			// stop() should NOT have been called
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.stop).not.toHaveBeenCalled();
		});

		it('should force-stop a service stuck in stopping state when plugin is disabled', async () => {
			const service = createMockService('plugin', 'buddy-whatsapp', 'bot', 'stopping');

			manager.register(service);

			configService.getPluginConfig.mockReturnValue({ enabled: false });

			const promise = manager.handleConfigUpdated();

			await jest.advanceTimersByTimeAsync(11_000);

			await promise;

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.stop).toHaveBeenCalled();
		});
	});
});
