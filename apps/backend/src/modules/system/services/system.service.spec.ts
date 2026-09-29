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
import { SystemStatsProvider } from '../providers/system-stats.provider';
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
						getPlatformType: jest.fn().mockReturnValue('generic'),
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
		jest.useRealTimers();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
		expect(eventEmitter).toBeDefined();
		expect(platform).toBeDefined();
	});

	describe('getSystemInfo', () => {
		it('bounds a hung sample, rejects later callers without new probes and recovers after late completion', async () => {
			jest.useFakeTimers();
			let resolve: (info: SystemInfoDto) => void;
			const sample = new Promise<SystemInfoDto>((done) => {
				resolve = done;
			});
			const getInfo = jest.spyOn(platform, 'getSystemInfo').mockReturnValueOnce(sample);
			const broadcast = service.broadcastSystemInfo();
			const first = expect(service.getSystemInfo()).rejects.toThrow('probe timed out');

			await jest.advanceTimersByTimeAsync(8_000);
			const later = expect(service.getSystemInfo()).rejects.toThrow('probe timed out');
			await jest.advanceTimersByTimeAsync(2_000);
			await Promise.all([broadcast, first, later]);
			expect(eventEmitter.emit).not.toHaveBeenCalled();

			for (let i = 0; i < 3; i++) {
				await jest.advanceTimersByTimeAsync(60_000);
				await expect(service.getSystemInfo()).rejects.toThrow('probe timed out');
			}
			expect(getInfo).toHaveBeenCalledTimes(1);
			expect(jest.getTimerCount()).toBe(0);

			resolve(toInstance(SystemInfoDto, { cpuLoad: 10 }));
			await jest.advanceTimersByTimeAsync(0);
			expect(eventEmitter.emit).not.toHaveBeenCalled();
			getInfo.mockResolvedValue(toInstance(SystemInfoDto, { cpuLoad: 20 }));
			await expect(service.getSystemInfo()).resolves.toEqual(expect.objectContaining({ cpuLoad: 20 }));
			expect(getInfo).toHaveBeenCalledTimes(2);
			expect(jest.getTimerCount()).toBe(0);
		});

		it('handles a late probe rejection after timeout and permits a fresh sample', async () => {
			jest.useFakeTimers();
			let reject: (error: Error) => void;
			const sample = new Promise<SystemInfoDto>((_resolve, fail) => {
				reject = fail;
			});
			const getInfo = jest.spyOn(platform, 'getSystemInfo').mockReturnValueOnce(sample);
			const timedOut = expect(service.getSystemInfo()).rejects.toThrow('probe timed out');

			await jest.advanceTimersByTimeAsync(10_000);
			await timedOut;
			reject(new Error('late failure'));
			await jest.advanceTimersByTimeAsync(0);

			getInfo.mockResolvedValue(toInstance(SystemInfoDto, { cpuLoad: 20 }));
			await expect(service.getSystemInfo()).resolves.toEqual(expect.objectContaining({ cpuLoad: 20 }));
			expect(getInfo).toHaveBeenCalledTimes(2);
			expect(jest.getTimerCount()).toBe(0);
		});

		it('does not retain a synchronously failing platform invocation', async () => {
			const getInfo = jest.spyOn(platform, 'getSystemInfo').mockImplementationOnce(() => {
				throw new Error('synchronous failure');
			});

			await expect(service.getSystemInfo()).rejects.toThrow('synchronous failure');
			getInfo.mockResolvedValue(toInstance(SystemInfoDto, { cpuLoad: 20 }));
			await expect(service.getSystemInfo()).resolves.toEqual(expect.objectContaining({ cpuLoad: 20 }));
			expect(getInfo).toHaveBeenCalledTimes(2);
		});

		it('shares one pending sample between both broadcasts and HTTP consumers, then samples again', async () => {
			let resolve: (info: SystemInfoDto) => void;
			const pending = new Promise<SystemInfoDto>((done) => {
				resolve = done;
			});
			const sample = toInstance(SystemInfoDto, {
				cpuLoad: 12,
				memory: { total: 100, used: 25, free: 75 },
				storage: [{ size: 100, used: 20 }],
				os: { uptime: 60 },
				process: { uptime: 30 },
				temperature: { cpu: 42 },
			});
			const getInfo = jest.spyOn(platform, 'getSystemInfo').mockReturnValueOnce(pending).mockResolvedValue(sample);
			const broadcast = service.broadcastSystemInfo();
			const stats = new SystemStatsProvider(service).getStats();
			const http = service.getSystemInfo();

			expect(getInfo).toHaveBeenCalledTimes(1);
			resolve(sample);
			const [, statsResult, httpResult] = await Promise.all([broadcast, stats, http]);

			expect(statsResult.memUsedPct.value).toBe(25);
			expect(httpResult.cpuLoad).toBe(12);
			const emitted = jest.mocked(eventEmitter.emit).mock.calls[0][1] as SystemInfoModel;
			httpResult.memory.used = 99;
			expect(emitted.memory.used).toBe(25);
			expect(sample.memory.used).toBe(25);

			await service.getSystemInfo();
			expect(getInfo).toHaveBeenCalledTimes(2);
		});

		it('releases a failed shared sample so the next caller can retry', async () => {
			let reject: (error: Error) => void;
			const pending = new Promise<SystemInfoDto>((_resolve, fail) => {
				reject = fail;
			});
			const getInfo = jest.spyOn(platform, 'getSystemInfo').mockReturnValueOnce(pending);
			const first = expect(service.getSystemInfo()).rejects.toThrow('probe failed');
			const second = expect(service.getSystemInfo()).rejects.toThrow('probe failed');

			reject(new Error('probe failed'));
			await Promise.all([first, second]);
			expect(getInfo).toHaveBeenCalledTimes(1);

			getInfo.mockResolvedValue(toInstance(SystemInfoDto, { cpuLoad: 20 }));
			await expect(service.getSystemInfo()).resolves.toEqual(expect.objectContaining({ cpuLoad: 20 }));
			expect(getInfo).toHaveBeenCalledTimes(2);
		});

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
