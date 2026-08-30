import { ConfigService as NestConfigService } from '@nestjs/config';

import { ConfigService } from '../../config/services/config.service';
import { PluginConfigValidatorService } from '../../config/services/plugin-config-validator.service';

import { IManagedPluginService, ServiceState } from './managed-plugin-service.interface';
import { PluginServiceManagerService } from './plugin-service-manager.service';

/**
 * Minimal mock service whose state can be controlled externally.
 */
function createMockService(
	pluginName: string,
	serviceId: string,
	initialState: ServiceState = 'stopped',
): IManagedPluginService & { _state: ServiceState } {
	const svc: IManagedPluginService & { _state: ServiceState } = {
		pluginName,
		serviceId,
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

describe('PluginServiceManagerService', () => {
	let manager: PluginServiceManagerService;
	let configService: { getPluginConfig: jest.Mock };
	let nestConfigService: { get: jest.Mock };
	let pluginConfigValidator: { hasValidator: jest.Mock; validate: jest.Mock };

	beforeEach(() => {
		jest.useFakeTimers();

		configService = {
			getPluginConfig: jest.fn().mockReturnValue({ enabled: true }),
		};

		nestConfigService = {
			get: jest.fn().mockReturnValue(null), // not CLI mode
		};

		pluginConfigValidator = {
			hasValidator: jest.fn().mockReturnValue(false),
			validate: jest.fn().mockResolvedValue({ valid: true }),
		};

		manager = new PluginServiceManagerService(
			configService as unknown as ConfigService,
			nestConfigService as unknown as NestConfigService,
			pluginConfigValidator as unknown as PluginConfigValidatorService,
		);

		// Mark startup as complete so handleConfigUpdated processes events
		(manager as unknown as { startupComplete: boolean }).startupComplete = true;
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('syncServiceState with timed-out transitional states', () => {
		it('keeps an enabled service stopped when its runtime configuration needs attention', async () => {
			const service = createMockService('devices-provider', 'connector');

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
			await expect(manager.getServiceStatus('devices-provider', 'connector')).resolves.toEqual(
				expect.objectContaining({
					state: 'stopped',
					lastError: 'Config validation failed: API key is required',
				}),
			);
		});

		it('keeps an enabled service stopped when its readiness check is temporarily unavailable', async () => {
			const service = createMockService('devices-provider', 'connector');

			pluginConfigValidator.hasValidator.mockReturnValue(true);
			pluginConfigValidator.validate.mockRejectedValue(new Error('private storage failure'));
			manager.register(service);

			await manager.handleConfigUpdated();

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).not.toHaveBeenCalled();
			await expect(manager.getServiceStatus('devices-provider', 'connector')).resolves.toEqual(
				expect.objectContaining({
					state: 'stopped',
					lastError: 'Configuration readiness check is temporarily unavailable',
				}),
			);
		});

		it('retries a transient readiness failure and starts after recovery', async () => {
			const service = createMockService('devices-provider', 'connector');

			pluginConfigValidator.hasValidator.mockReturnValue(true);
			pluginConfigValidator.validate
				.mockRejectedValueOnce(new Error('private storage failure'))
				.mockResolvedValue({ valid: true });
			manager.register(service);

			await manager.handleConfigUpdated();
			await jest.advanceTimersByTimeAsync(15_000);

			expect(pluginConfigValidator.validate).toHaveBeenCalledTimes(2);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).toHaveBeenCalledTimes(1);
			await expect(manager.getServiceStatus('devices-provider', 'connector')).resolves.toEqual(
				expect.objectContaining({ state: 'started', lastError: undefined }),
			);
		});

		it('bounds automatic retries for a persistent readiness failure', async () => {
			const service = createMockService('devices-provider', 'connector');

			pluginConfigValidator.hasValidator.mockReturnValue(true);
			pluginConfigValidator.validate.mockRejectedValue(new Error('private storage failure'));
			manager.register(service);

			await manager.handleConfigUpdated();
			await jest.advanceTimersByTimeAsync(120_000);

			expect(pluginConfigValidator.validate).toHaveBeenCalledTimes(4);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).not.toHaveBeenCalled();
			expect(jest.getTimerCount()).toBe(0);
		});

		it('cancels a pending readiness retry when the plugin is disabled', async () => {
			const service = createMockService('devices-provider', 'connector');

			pluginConfigValidator.hasValidator.mockReturnValue(true);
			pluginConfigValidator.validate.mockRejectedValue(new Error('private storage failure'));
			manager.register(service);

			await manager.handleConfigUpdated();
			configService.getPluginConfig.mockReturnValue({ enabled: false });
			await manager.handleConfigUpdated();
			await jest.advanceTimersByTimeAsync(120_000);

			expect(pluginConfigValidator.validate).toHaveBeenCalledTimes(1);
			expect(jest.getTimerCount()).toBe(0);
		});

		it('should force-stop a service stuck in starting state when plugin is disabled', async () => {
			// Create a service that stays in 'starting' (simulates WhatsApp QR scan)
			const service = createMockService('buddy-whatsapp', 'bot', 'starting');

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
			const service = createMockService('buddy-whatsapp', 'bot', 'starting');

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
			const service = createMockService('buddy-whatsapp', 'bot', 'stopping');

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
