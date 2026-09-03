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

		it('retries resolving the connection issue on a later auth_ok when resolve() rejects', async () => {
			const startPromise = service.start();

			await new Promise((resolve) => setImmediate(resolve));

			await service['handleMessage'](JSON.stringify({ type: 'auth_required' }));
			await service['handleMessage'](JSON.stringify({ type: 'auth_invalid', message: 'Invalid token' }));
			await expect(startPromise).rejects.toThrow('Invalid token');

			expect(mockNotifications.notify).toHaveBeenCalledTimes(1);

			mockNotifications.resolve.mockRejectedValueOnce(new Error('db is down'));
			await service['handleMessage'](JSON.stringify({ type: 'auth_ok' }));

			expect(mockNotifications.resolve).toHaveBeenCalledTimes(1);

			// A later auth_ok - the earlier resolve never actually landed, so this retries it.
			await service['handleMessage'](JSON.stringify({ type: 'auth_ok' }));

			expect(mockNotifications.resolve).toHaveBeenCalledTimes(2);
			expect(mockNotifications.resolve).toHaveBeenNthCalledWith(2, DEVICES_HOME_ASSISTANT_PLUGIN_NAME, 'connection');
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

		it('does not raise or schedule a reconnect when the close continuation resumes after stop()', async () => {
			service['state'] = 'started';
			service['connect']();

			const closeHandler = getRegisteredHandler('close');

			let resolveNotify: (value: unknown) => void = () => {};
			const pendingNotify = new Promise((resolve) => {
				resolveNotify = resolve;
			});

			mockNotifications.notify.mockReturnValueOnce(pendingNotify);

			// First close: a silent blip.
			closeHandler();
			await flush();

			// Second, consecutive close: starts raising - notify() is now in flight and paused,
			// simulating stop() racing a slow write.
			closeHandler();
			await flush();

			expect(mockNotifications.notify).toHaveBeenCalledTimes(1);

			const stopPromise = service.stop();

			// Let the paused notify() complete now that stop() is waiting on the continuation.
			resolveNotify(null);
			await stopPromise;

			expect(mockNotifications.resolveAll).toHaveBeenCalledWith(DEVICES_HOME_ASSISTANT_PLUGIN_NAME);
			// The generation went stale while notify() was in flight, so the continuation must
			// not have gone on to schedule a reconnect once it resumed.
			expect(service['reconnectTimeout']).toBeNull();

			// notify() settled strictly before resolveAll() ran, so whatever it created was
			// already visible for resolveAll() to clean up - nothing is left dangling open.
			const notifyOrder = mockNotifications.notify.mock.invocationCallOrder[0];
			const resolveAllOrder = mockNotifications.resolveAll.mock.invocationCallOrder[0];

			expect(notifyOrder).toBeLessThan(resolveAllOrder);
		});

		it('ignores a stale socket generation when a superseded reconnect timer fires', () => {
			jest.useFakeTimers();

			service['state'] = 'started';
			service['connect']();

			// Schedule a reconnect for the current generation directly, bypassing
			// handleUnexpectedClose - isolating the timer's own generation guard.
			service['scheduleReconnect']();

			const websocketConstructor = WebSocket as unknown as jest.Mock;
			const callsBeforeSupersede = websocketConstructor.mock.calls.length;

			// A newer connection attempt supersedes the generation the pending timer was
			// scheduled for (e.g. a reconnect succeeding through a different path first).
			service['connect']();

			expect(websocketConstructor.mock.calls.length).toBe(callsBeforeSupersede + 1);

			// The stale timer fires. Its captured generation no longer matches, so it must not
			// connect again and replace the active socket.
			jest.advanceTimersByTime(30_000);

			expect(websocketConstructor.mock.calls.length).toBe(callsBeforeSupersede + 1);
		});
	});
});
