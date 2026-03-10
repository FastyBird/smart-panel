import { ConfigService as NestConfigService } from '@nestjs/config';

import { ConfigService } from '../../config/services/config.service';
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
		start: jest.fn(async () => {
			svc._state = 'started';
		}),
		stop: jest.fn(async () => {
			svc._state = 'stopped';
		}),
		getState: jest.fn(() => svc._state),
	};

	return svc;
}

describe('PluginServiceManagerService', () => {
	let manager: PluginServiceManagerService;
	let configService: { getPluginConfig: jest.Mock };
	let nestConfigService: { get: jest.Mock };

	beforeEach(() => {
		jest.useFakeTimers();

		configService = {
			getPluginConfig: jest.fn().mockReturnValue({ enabled: true }),
		};

		nestConfigService = {
			get: jest.fn().mockReturnValue(null), // not CLI mode
		};

		manager = new PluginServiceManagerService(
			configService as unknown as ConfigService,
			nestConfigService as unknown as NestConfigService,
		);

		// Mark startup as complete so handleConfigUpdated processes events
		(manager as unknown as { startupComplete: boolean }).startupComplete = true;
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('syncServiceState with timed-out transitional states', () => {
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
			expect(service.stop).not.toHaveBeenCalled();
		});

		it('should force-stop a service stuck in stopping state when plugin is disabled', async () => {
			const service = createMockService('buddy-whatsapp', 'bot', 'stopping');

			manager.register(service);

			configService.getPluginConfig.mockReturnValue({ enabled: false });

			await manager.handleConfigUpdated();

			expect(service.stop).toHaveBeenCalled();
		});
	});
});
