import WebSocket from 'ws';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../../modules/config/services/config.service';
import { DevicesHomeAssistantException } from '../devices-home-assistant.exceptions';
import { HomeAssistantConfigModel } from '../models/config.model';

import { HomeAssistantHttpService } from './home-assistant.http.service';
import { HomeAssistantWsService } from './home-assistant.ws.service';

jest.mock('ws');

describe('HomeAssistantWsService', () => {
	let service: HomeAssistantWsService;
	let mockConfigService: Partial<ConfigService>;
	let mockHttpService: Partial<HomeAssistantHttpService>;
	let mockWs: {
		send: jest.Mock;
		close: jest.Mock;
		on: jest.Mock;
		readyState: number;
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
			],
		}).compile();

		service = module.get(HomeAssistantWsService);

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	});

	afterEach(() => {
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

		// Simulate auth flow with invalid credentials
		await service['handleMessage'](JSON.stringify({ type: 'auth_required' }));
		await service['handleMessage'](JSON.stringify({ type: 'auth_invalid', message: 'Invalid token' }));

		await startPromise;

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
});
