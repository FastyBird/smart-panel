import WebSocket from 'ws';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../../modules/config/services/config.service';
import { DevicesHomeAssistantException } from '../devices-home-assistant.exceptions';
import { HomeAssistantConfigModel } from '../models/config.model';

import { HomeAssistantWsService } from './home-assistant.ws.service';

jest.mock('ws');

describe('HomeAssistantWsService', () => {
	let service: HomeAssistantWsService;
	let mockConfigService: Partial<ConfigService>;

	beforeEach(async () => {
		mockConfigService = {
			getPluginConfig: jest.fn().mockReturnValue({
				apiKey: 'mock-token',
				hostname: 'localhost:8123',
			} as HomeAssistantConfigModel),
		};

		(WebSocket as unknown as jest.Mock).mockImplementation(() => {
			return {
				send: jest.fn(),
				close: jest.fn(),
				on: jest.fn(),
				readyState: WebSocket.OPEN,
			};
		});

		const module: TestingModule = await Test.createTestingModule({
			providers: [HomeAssistantWsService, { provide: ConfigService, useValue: mockConfigService }],
		}).compile();

		service = module.get(HomeAssistantWsService);

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.clearAllMocks();
	});

	it('should register handler successfully', () => {
		const handler = { event: 'test', handle: jest.fn() };

		service.registerEventsHandler('test', handler);

		expect(() => service.registerEventsHandler('test', handler)).toThrow(DevicesHomeAssistantException);
	});

	it('should reject send if not connected', async () => {
		service['ws'] = { readyState: WebSocket.CLOSED } as unknown as WebSocket;

		await expect(service.send({ type: 'ping' })).rejects.toThrow('Home Assistant socket connection is not open.');
	});

	it('should resolve send promise when matching response arrives', async () => {
		jest.useFakeTimers();

		service.connect();

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

		service.connect();

		const promise = service.send({ type: 'ping' });

		jest.advanceTimersByTime(10000);

		await expect(promise).rejects.toThrow('Home Assistant WS response timed out (id=1)');
	});
});
