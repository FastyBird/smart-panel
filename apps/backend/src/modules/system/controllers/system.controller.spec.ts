/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Test, TestingModule } from '@nestjs/testing';

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
				temperature: {
					cpu: 45,
				},
				os: {
					platform: 'linux',
					distro: 'Ubuntu',
					release: '20.04',
					uptime: 1234,
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

			jest.spyOn(service, 'getSystemInfo').mockResolvedValue(mockSystemInfo);

			const result = await controller.getSystemInfo();

			expect(result).toBeInstanceOf(SystemInfoModel);
			expect(result.cpuLoad).toBe(mockSystemInfo.cpuLoad);
			expect(service.getSystemInfo).toHaveBeenCalled();
		});

		it('should log a message when called', async () => {
			const loggerSpy = jest.spyOn(controller['logger'], 'debug').mockImplementation();

			jest.spyOn(service, 'getSystemInfo').mockResolvedValue({} as SystemInfoModel);

			await controller.getSystemInfo();

			expect(loggerSpy).toHaveBeenCalledWith('[LOOKUP] Fetching system info');
			expect(loggerSpy).toHaveBeenCalledWith('[LOOKUP] Successfully retrieved system info');
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

			jest.spyOn(service, 'getThrottleStatus').mockResolvedValue(mockThrottleStatus);

			const result = await controller.getThrottleStatus();

			expect(result).toBeInstanceOf(ThrottleStatusModel);
			expect(result.undervoltage).toBe(mockThrottleStatus.undervoltage);
			expect(service.getThrottleStatus).toHaveBeenCalled();
		});

		it('should log a message when called', async () => {
			const loggerSpy = jest.spyOn(controller['logger'], 'debug').mockImplementation();

			jest.spyOn(service, 'getThrottleStatus').mockResolvedValue({} as ThrottleStatusModel);

			await controller.getThrottleStatus();

			expect(loggerSpy).toHaveBeenCalledWith('[LOOKUP] Fetching throttle status');
			expect(loggerSpy).toHaveBeenCalledWith('[LOOKUP] Successfully retrieved throttle status');
		});
	});
});
