/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { SystemInfoDto } from '../../platform/dto/system-info.dto';
import { PlatformService } from '../../platform/services/platform.service';
import { SystemInfoModel } from '../models/system.model';
import { EventType } from '../system.constants';

import { SystemService } from './system.service';

describe('SystemService', () => {
	let service: SystemService;
	let eventEmitter: EventEmitter2;
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
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(() => {}),
					},
				},
			],
		}).compile();

		service = module.get<SystemService>(SystemService);
		eventEmitter = module.get<EventEmitter2>(EventEmitter2);
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
		expect(eventEmitter).toBeDefined();
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
				defaultNetwork: {
					interface: 'eth0',
					ip4: '192.168.0.1',
					ip6: 'fe80::134a:1e43:abc5:d413',
					mac: 'xx:xx:xx:xx:xx:xx',
				},
				display: {
					resolutionX: 1024,
					resolutionY: 768,
					currentResX: 1024,
					currentResY: 768,
				},
			};

			jest.spyOn(service['platformService'], 'getSystemInfo').mockResolvedValue(toInstance(SystemInfoDto, mockInfo));

			const result = await service.getSystemInfo();

			expect(result).toBeInstanceOf(SystemInfoModel);
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

			jest.spyOn(service, 'getSystemInfo').mockResolvedValue(toInstance(SystemInfoModel, mockInfo));

			await service.broadcastSystemInfo();

			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.SYSTEM_INFO, expect.any(SystemInfoModel));
		});

		it('should log an error if broadcasting fails', async () => {
			const loggerSpy = jest.spyOn(Logger.prototype, 'error');

			jest.spyOn(service, 'getSystemInfo').mockRejectedValue(new Error('Error fetching system info'));

			await service.broadcastSystemInfo();

			expect(loggerSpy).toHaveBeenCalledWith(
				expect.stringContaining('[SystemService] Failed to broadcast system info'),
				undefined,
				expect.objectContaining({ tag: 'system-module' }),
			);
		});
	});
});
