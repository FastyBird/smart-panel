import WebSocket from 'ws';

import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../../modules/config/services/config.service';
import {
	NotificationActionType,
	NotificationKind,
	NotificationSeverity,
} from '../../../modules/notifications/notifications.constants';
import { NotificationsService } from '../../../modules/notifications/services/notifications.service';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME } from '../devices-home-assistant.constants';
import { DevicesHomeAssistantException } from '../devices-home-assistant.exceptions';
import { HomeAssistantConfigModel } from '../models/config.model';

import { HaSupervisorService } from './ha-supervisor.service';
import { HomeAssistantHttpService } from './home-assistant.http.service';
import { HomeAssistantWsService } from './home-assistant.ws.service';

jest.mock('ws');

describe('HomeAssistantWsService', () => {
	let service: HomeAssistantWsService;
	let mockConfigService: Partial<ConfigService>;
	let mockHttpService: Partial<HomeAssistantHttpService>;
	let mockNotifications: { notify: jest.Mock; resolve: jest.Mock; resolveAll: jest.Mock };
	let mockWs: {
		send: jest.Mock;
		close: jest.Mock;
		on: jest.Mock;
		readyState: number;
	};

	/** Waits out one real event-loop turn so a fire-and-forget async handler completes. */
	const flush = () => new Promise((resolve) => setImmediate(resolve));

	/** Retrieves the listener `connect()` registered on the mock socket for a given event. */
	const getRegisteredHandler = (event: string): (() => void) => {
		const calls = mockWs.on.mock.calls as [string, () => void][];
		const call = calls.find(([registeredEvent]) => registeredEvent === event);

		if (!call) {
			throw new Error(`No handler registered for event: ${event}`);
		}

		return call[1];
	};

	beforeEach(async () => {
		mockConfigService = {
			getPluginConfig: jest.fn().mockReturnValue({
				enabled: true,
				apiKey: 'mock-token',
				hostname: 'localhost:8123',
			} as HomeAssistantConfigModel),
		};

		mockHttpService = {
			loadStates: jest.fn().mockResolvedValue(undefined),
			markAllDevicesConnected: jest.fn().mockResolvedValue(undefined),
			markAllDevicesDisconnected: jest.fn().mockResolvedValue(undefined),
		};

		mockNotifications = {
			notify: jest.fn().mockResolvedValue(null),
			resolve: jest.fn().mockResolvedValue(true),
			resolveAll: jest.fn().mockResolvedValue(0),
		};

		mockWs = {
			send: jest.fn(),
			close: jest.fn(),
			on: jest.fn(),
			readyState: WebSocket.OPEN,
		};

		(WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				HomeAssistantWsService,
				{ provide: ConfigService, useValue: mockConfigService },
				{ provide: HomeAssistantHttpService, useValue: mockHttpService },
				{ provide: NotificationsService, useValue: mockNotifications },
				{
					provide: HaSupervisorService,
					useValue: {
						isInSupervisorMode: () => false,
						getSupervisorToken: () => null,
						getSupervisorApiUrl: () => '',
						getSupervisorWsUrl: () => '',
					},
				},
			],
		}).compile();

		service = module.get(HomeAssistantWsService);
	});

	afterEach(() => {
		// A test that drives an unexpected close leaves a real reconnect timer scheduled;
		// clear it so it cannot fire against a torn-down service once the test has moved on.
		const pendingReconnect = service?.['reconnectTimeout'];

		if (pendingReconnect) {
			clearTimeout(pendingReconnect);
		}

		jest.useRealTimers();
		jest.clearAllMocks();
	});

	/**
	 * Helper to set up a "started" service state for testing
	 */
	const setupStartedService = () => {
		service['state'] = 'started';
		service['ws'] = mockWs as unknown as WebSocket;
	};

	it('should register handler successfully', () => {
		const handler = { event: 'test', handle: jest.fn() };

		service.registerEventsHandler('test', handler);

		expect(() => service.registerEventsHandler('test', handler)).toThrow(DevicesHomeAssistantException);
	});

	it('should reject send if not connected', async () => {
		service['ws'] = { readyState: WebSocket.CLOSED } as unknown as WebSocket;

		await expect(service.send({ type: 'ping' })).rejects.toThrow('Home Assistant socket connection is not open.');
	});

	it('should start service and transition through states correctly', async () => {
		expect(service.getState()).toBe('stopped');

		// Start the service - this initiates connection
		const startPromise = service.start();

		// Wait for the lock to be acquired and state to transition
		await new Promise((resolve) => setImmediate(resolve));

		// State should be 'starting' while waiting for auth
		expect(service.getState()).toBe('starting');

		// Simulate successful authentication
		await service['handleMessage'](JSON.stringify({ type: 'auth_required' }));
		await service['handleMessage'](JSON.stringify({ type: 'auth_ok' }));

		await startPromise;

		expect(service.getState()).toBe('started');
	});

	it('should set error state on auth_invalid', async () => {
		const startPromise = service.start();

		// Wait for the lock to be acquired and state to transition
		await new Promise((resolve) => setImmediate(resolve));

		// Simulate auth flow with invalid credentials
		await service['handleMessage'](JSON.stringify({ type: 'auth_required' }));
		await service['handleMessage'](JSON.stringify({ type: 'auth_invalid', message: 'Invalid token' }));

		// start() now throws on error to signal failure to ManagedServiceManagerService
		await expect(startPromise).rejects.toThrow('Invalid token');

		expect(service.getState()).toBe('error');
	});

	it('should resolve send promise when matching response arrives', async () => {
		setupStartedService();

		const responseData = JSON.stringify({
			id: 1,
			type: 'result',
			success: true,
			result: [],
		});

		const sendPromise = service.send({ type: 'config/device_registry/get' });

		// Simulate message received
		await service['handleMessage'](responseData);

		await expect(sendPromise).resolves.toEqual(responseData);
	});

	it('should timeout send after 10s', async () => {
		jest.useFakeTimers();

		setupStartedService();

		const promise = service.send({ type: 'ping' });

		jest.advanceTimersByTime(10000);

		await expect(promise).rejects.toThrow('Home Assistant WS response timed out (id=1)');
	});

	it('should call loadStates after successful authentication', async () => {
		const startPromise = service.start();

		// Simulate successful authentication
		await service['handleMessage'](JSON.stringify({ type: 'auth_required' }));
		await service['handleMessage'](JSON.stringify({ type: 'auth_ok' }));

		await startPromise;

		expect(mockHttpService.loadStates).toHaveBeenCalled();
	});

	it('should return early if already started', async () => {
		setupStartedService();

		await service.start();

		// WebSocket constructor should not be called again
		expect(WebSocket).not.toHaveBeenCalled();
	});

	describe('connection notification', () => {
		it('raises the connection issue immediately on auth_invalid', async () => {
			const startPromise = service.start();

			await new Promise((resolve) => setImmediate(resolve));

			await service['handleMessage'](JSON.stringify({ type: 'auth_required' }));
			await service['handleMessage'](JSON.stringify({ type: 'auth_invalid', message: 'Invalid token' }));

			await expect(startPromise).rejects.toThrow('Invalid token');

			expect(mockNotifications.notify).toHaveBeenCalledTimes(1);
			expect(mockNotifications.notify).toHaveBeenCalledWith(
				expect.objectContaining({
					source: DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
					kind: NotificationKind.ISSUE,
					key: 'connection',
					severity: NotificationSeverity.ERROR,
					actions: [
						{
							type: NotificationActionType.SERVICE,
							label: 'Restart service',
							extension_kind: 'plugin',
							extension_type: DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
							service_id: 'connector',
							operation: 'restart',
							primary: true,
						},
						{
							type: NotificationActionType.LINK,
							label: 'Open Home Assistant settings',
							url: `/extensions/${DEVICES_HOME_ASSISTANT_PLUGIN_NAME}`,
						},
					],
				}),
			);
		});

		it('resolves the connection issue once auth_ok is received', async () => {
			const startPromise = service.start();

			await new Promise((resolve) => setImmediate(resolve));

			await service['handleMessage'](JSON.stringify({ type: 'auth_required' }));
			await service['handleMessage'](JSON.stringify({ type: 'auth_invalid', message: 'Invalid token' }));
			await expect(startPromise).rejects.toThrow('Invalid token');

			expect(mockNotifications.notify).toHaveBeenCalledTimes(1);

			await service['handleMessage'](JSON.stringify({ type: 'auth_ok' }));

			expect(mockNotifications.resolve).toHaveBeenCalledWith(DEVICES_HOME_ASSISTANT_PLUGIN_NAME, 'connection');
		});

		it('stays silent on a single unexpected close, and raises once the reconnect attempt also fails', async () => {
			service['state'] = 'started';
			service['connect']();

			const closeHandler = getRegisteredHandler('close');

			// First close: a single blip. Reconnect is scheduled silently.
			closeHandler();
			await flush();

			expect(mockNotifications.notify).not.toHaveBeenCalled();

			// Second, consecutive close: the reconnect attempt itself failed too.
			closeHandler();
			await flush();

			expect(mockNotifications.notify).toHaveBeenCalledTimes(1);
			expect(mockNotifications.notify).toHaveBeenCalledWith(
				expect.objectContaining({
					source: DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
					kind: NotificationKind.ISSUE,
					key: 'connection',
					severity: NotificationSeverity.ERROR,
				}),
			);

			// A third close is still the same open issue - no re-raise.
			closeHandler();
			await flush();

			expect(mockNotifications.notify).toHaveBeenCalledTimes(1);
		});

		it('does not raise on close while intentionally disconnecting', async () => {
			service['state'] = 'started';
			service['connect']();

			const closeHandler = getRegisteredHandler('close');

			service['intentionalDisconnect'] = true;

			closeHandler();
			await flush();
			closeHandler();
			await flush();

			expect(mockNotifications.notify).not.toHaveBeenCalled();
		});

		it('resolves every open issue for this plugin when stopped', async () => {
			setupStartedService();

			await service.stop();

			expect(mockNotifications.resolveAll).toHaveBeenCalledWith(DEVICES_HOME_ASSISTANT_PLUGIN_NAME);
		});
	});
});
