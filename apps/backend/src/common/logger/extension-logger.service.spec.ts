import { ExtensionLoggerService, createExtensionLogger } from './extension-logger.service';

describe('ExtensionLoggerService', () => {
	describe('createExtensionLogger', () => {
		test('creates logger with correct context', () => {
			const logger = createExtensionLogger('devices-shelly-ng-plugin', 'ShellyService');
			expect(logger).toBeInstanceOf(ExtensionLoggerService);
		});
	});

	describe('message formatting', () => {
		test('formats message with component name only (extension type is passed as tag)', () => {
			const logger = new ExtensionLoggerService();
			logger.setContext('devices-shelly-ng-plugin', 'ShellyService');

			const formatted = (logger as unknown as { formatMessage: (msg: string) => string }).formatMessage(
				'Starting service',
			);
			expect(formatted).toBe('[ShellyService] Starting service');
		});

		test('formats message for home-assistant plugin', () => {
			const logger = new ExtensionLoggerService();
			logger.setContext('devices-home-assistant-plugin', 'WsService');

			const formatted = (logger as unknown as { formatMessage: (msg: string) => string }).formatMessage(
				'Connected to server',
			);
			expect(formatted).toBe('[WsService] Connected to server');
		});

		test('formats message for pages plugin', () => {
			const logger = new ExtensionLoggerService();
			logger.setContext('pages-tiles-plugin', 'TilesService');

			const formatted = (logger as unknown as { formatMessage: (msg: string) => string }).formatMessage(
				'Loading tiles',
			);
			expect(formatted).toBe('[TilesService] Loading tiles');
		});

		test('formats message for logger plugin', () => {
			const logger = new ExtensionLoggerService();
			logger.setContext('logger-rotating-file-plugin', 'FileLogger');

			const formatted = (logger as unknown as { formatMessage: (msg: string) => string }).formatMessage(
				'Rotating log file',
			);
			expect(formatted).toBe('[FileLogger] Rotating log file');
		});

		test('formats message for WLED plugin', () => {
			const logger = new ExtensionLoggerService();
			logger.setContext('devices-wled-plugin', 'WledService');

			const formatted = (logger as unknown as { formatMessage: (msg: string) => string }).formatMessage(
				'Device connected',
			);
			expect(formatted).toBe('[WledService] Device connected');
		});
	});

	describe('setContext', () => {
		test('stores extension type and component name', () => {
			const logger = new ExtensionLoggerService();
			logger.setContext('devices-test-plugin', 'TestService');

			// Verify by checking formatted message
			const formatted = (logger as unknown as { formatMessage: (msg: string) => string }).formatMessage('test');
			expect(formatted).toBe('[TestService] test');
		});
	});
});
