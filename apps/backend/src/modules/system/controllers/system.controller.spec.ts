/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { SystemInfoModel, ThrottleStatusModel } from '../models/system.model';
import { SystemService } from '../services/system.service';

import { SystemController } from './system.controller';

describe('SystemController', () => {
	let controller: SystemController;
	let service: SystemService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [SystemController],
			providers: [
				{
					provide: SystemService,
					useValue: {
						getSystemInfo: jest.fn(),
						getThrottleStatus: jest.fn(),
					},
				},
			],
		}).compile();

		controller = module.get<SystemController>(SystemController);
		service = module.get<SystemService>(SystemService);

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(service).toBeDefined();
	});

	describe('getSystemInfo', () => {
		it('should return system info', async () => {
			const mockSystemInfo = {
				cpuLoad: 10,
				memory: {
					total: 1000,
					used: 500,
					free: 500,
				},
				storage: [],
				primaryStorage: {
					fs: '/dev/primaryDisk',
					used: 12044365824,
					size: 494384795648,
					available: 46296731648,
				},
				temperature: {
					cpu: 45,
				},
				os: {
					platform: 'linux',
					distro: 'Ubuntu',
					release: '20.04',
					uptime: 1234,
					node: '20.18.1',
					npm: '11.1.0',
					timezone: 'CET+0100',
				},
				network: [],
				defaultNetwork: {
					interface: 'eth0',
					ip4: '192.168.0.1',
					ip6: 'fe80::134a:1e43:abc5:d413',
					mac: 'xx:xx:xx:xx:xx:xx',
					hostname: 'smart-panel',
				},
				display: {
					resolutionX: 1024,
					resolutionY: 768,
					currentResX: 1024,
					currentResY: 768,
				},
				process: {
					pid: 17498,
					uptime: 1234,
				},
			};

			jest.spyOn(service, 'getSystemInfo').mockResolvedValue(toInstance(SystemInfoModel, mockSystemInfo));

			const result = await controller.getSystemInfo();

			expect(result.data).toEqual(toInstance(SystemInfoModel, mockSystemInfo));
			expect(result.data.cpuLoad).toBe(mockSystemInfo.cpuLoad);
			expect(service.getSystemInfo).toHaveBeenCalled();
		});
	});

	describe('getThrottleStatus', () => {
		it('should return throttle status', async () => {
			const mockThrottleStatus = {
				undervoltage: false,
				frequencyCapping: true,
				throttling: false,
				softTempLimit: false,
			};

			jest.spyOn(service, 'getThrottleStatus').mockResolvedValue(toInstance(ThrottleStatusModel, mockThrottleStatus));

			const result = await controller.getThrottleStatus();

			expect(result.data).toEqual(toInstance(ThrottleStatusModel, mockThrottleStatus));
			expect(result.data.undervoltage).toBe(mockThrottleStatus.undervoltage);
			expect(service.getThrottleStatus).toHaveBeenCalled();
		});
	});
});
