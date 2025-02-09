/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { plainToInstance } from 'class-transformer';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PlatformService } from '../../platform/services/platform.service';
import { WebsocketGateway } from '../../websocket/gateway/websocket.gateway';
import { SystemInfoEntity } from '../entities/system.entity';
import { EventType } from '../system.constants';

import { SystemService } from './system.service';

describe('SystemService', () => {
	let service: SystemService;
	let gateway: WebsocketGateway;
	let platform: PlatformService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SystemService,
				{
					provide: PlatformService,
					useValue: {
						getSystemInfo: jest.fn(),
						getThrottleStatus: jest.fn(),
						getTemperature: jest.fn(),
						getNetworkStats: jest.fn(),
					},
				},
				{
					provide: WebsocketGateway,
					useValue: {
						sendMessage: jest.fn(() => {}),
					},
				},
			],
		}).compile();

		service = module.get<SystemService>(SystemService);
		gateway = module.get<WebsocketGateway>(WebsocketGateway);
		platform = module.get<PlatformService>(PlatformService);

		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
		expect(gateway).toBeDefined();
		expect(platform).toBeDefined();
	});

	describe('getSystemInfo', () => {
		it('should return system info', async () => {
			const mockInfo = {
				cpuLoad: 10,
				memory: {
					total: 100,
					used: 50,
					free: 50,
				},
				storage: [],
				os: {
					platform: 'linux',
					distro: 'distro',
					release: 'release',
					uptime: 100,
				},
				temperature: {
					cpu: 40,
				},
				network: [],
				display: {
					resolutionX: 1024,
					resolutionY: 768,
					currentResX: 1024,
					currentResY: 768,
				},
			};

			jest.spyOn(service['platformService'], 'getSystemInfo').mockResolvedValue(mockInfo);

			const result = await service.getSystemInfo();

			expect(result).toBeInstanceOf(SystemInfoEntity);
			expect(result.cpuLoad).toBe(mockInfo.cpuLoad);
		});

		it('should log an error if fetching system info fails', async () => {
			jest
				.spyOn(service['platformService'], 'getSystemInfo')
				.mockRejectedValue(new Error('Error fetching system info'));

			await expect(service.getSystemInfo()).rejects.toThrow('Error fetching system info');
		});
	});

	describe('broadcastSystemInfo', () => {
		it('should broadcast system info over WebSocket', async () => {
			const mockInfo = { cpuLoad: 10 };

			jest.spyOn(service, 'getSystemInfo').mockResolvedValue(plainToInstance(SystemInfoEntity, mockInfo));

			await service.broadcastSystemInfo();

			expect(gateway.sendMessage).toHaveBeenCalledWith(EventType.SYSTEM_INFO, expect.any(SystemInfoEntity));
		});

		it('should log an error if broadcasting fails', async () => {
			const loggerSpy = jest.spyOn(Logger.prototype, 'error');

			jest.spyOn(service, 'getSystemInfo').mockRejectedValue(new Error('Error fetching system info'));

			await service.broadcastSystemInfo();

			expect(loggerSpy).toHaveBeenCalledWith('[EVENT] Failed to broadcast system info', expect.any(Object));
		});
	});
});
