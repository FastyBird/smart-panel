import { ExtensionLoggerService, createExtensionLogger } from './extension-logger.service';

describe('ExtensionLoggerService', () => {
	describe('createExtensionLogger', () => {
		test('creates logger with correct context', () => {
			const logger = createExtensionLogger('devices-shelly-ng-plugin', 'ShellyService');
			expect(logger).toBeInstanceOf(ExtensionLoggerService);
		});
	});

	describe('message formatting', () => {
		type LoggerInternal = {
			formatMessageWithContext: (msg: string, ctx?: string | Error | Record<string, unknown>) => string;
		};

		test('formats message with component name only (extension type is passed as tag)', () => {
			const logger = new ExtensionLoggerService();
			logger.setContext('devices-shelly-ng-plugin', 'ShellyService');

			const formatted = (logger as unknown as LoggerInternal).formatMessageWithContext('Starting service');
			expect(formatted).toBe('[ShellyService] Starting service');
		});

		test('formats message for home-assistant plugin', () => {
			const logger = new ExtensionLoggerService();
			logger.setContext('devices-home-assistant-plugin', 'WsService');

			const formatted = (logger as unknown as LoggerInternal).formatMessageWithContext('Connected to server');
			expect(formatted).toBe('[WsService] Connected to server');
		});

		test('formats message for pages plugin', () => {
			const logger = new ExtensionLoggerService();
			logger.setContext('pages-tiles-plugin', 'TilesService');

			const formatted = (logger as unknown as LoggerInternal).formatMessageWithContext('Loading tiles');
			expect(formatted).toBe('[TilesService] Loading tiles');
		});

		test('formats message for logger plugin', () => {
			const logger = new ExtensionLoggerService();
			logger.setContext('logger-rotating-file-plugin', 'FileLogger');

			const formatted = (logger as unknown as LoggerInternal).formatMessageWithContext('Rotating log file');
			expect(formatted).toBe('[FileLogger] Rotating log file');
		});

		test('formats message for WLED plugin', () => {
			const logger = new ExtensionLoggerService();
			logger.setContext('devices-wled-plugin', 'WledService');

			const formatted = (logger as unknown as LoggerInternal).formatMessageWithContext('Device connected');
			expect(formatted).toBe('[WledService] Device connected');
		});

		test('formats message with string context', () => {
			const logger = new ExtensionLoggerService();
			logger.setContext('devices-test-plugin', 'TestService');

			const formatted = (logger as unknown as LoggerInternal).formatMessageWithContext(
				'Error occurred',
				'stack trace here',
			);
			expect(formatted).toBe('[TestService] Error occurred stack trace here');
		});

		test('formats message with Error context', () => {
			const logger = new ExtensionLoggerService();
			logger.setContext('devices-test-plugin', 'TestService');

			const error = new Error('Something went wrong');
			const formatted = (logger as unknown as LoggerInternal).formatMessageWithContext('Error occurred', error);
			expect(formatted).toContain('[TestService] Error occurred');
			expect(formatted).toContain('Something went wrong');
		});

		test('formats message with object context', () => {
			const logger = new ExtensionLoggerService();
			logger.setContext('devices-test-plugin', 'TestService');

			const formatted = (logger as unknown as LoggerInternal).formatMessageWithContext('Request failed', {
				status: 500,
				url: '/api/test',
			});
			expect(formatted).toBe('[TestService] Request failed {"status":500,"url":"/api/test"}');
		});

		test('formats message with empty object context', () => {
			const logger = new ExtensionLoggerService();
			logger.setContext('devices-test-plugin', 'TestService');

			const formatted = (logger as unknown as LoggerInternal).formatMessageWithContext('No context', {});
			expect(formatted).toBe('[TestService] No context');
		});
	});

	describe('setContext', () => {
		test('stores extension type and component name', () => {
			const logger = new ExtensionLoggerService();
			logger.setContext('devices-test-plugin', 'TestService');

			// Verify by checking formatted message
			const formatted = (
				logger as unknown as { formatMessageWithContext: (msg: string) => string }
			).formatMessageWithContext('test');
			expect(formatted).toBe('[TestService] test');
		});
	});
});
