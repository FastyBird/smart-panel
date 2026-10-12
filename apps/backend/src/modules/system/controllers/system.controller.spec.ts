/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { OnboardingStatusModel } from '../models/onboarding.model';
import { SystemInfoModel, ThrottleStatusModel } from '../models/system.model';
import { OnboardingService } from '../services/onboarding.service';
import { SystemService } from '../services/system.service';

import { SystemController } from './system.controller';

describe('SystemController', () => {
	let controller: SystemController;
	let service: SystemService;
	let onboardingService: OnboardingService;

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
				{
					provide: OnboardingService,
					useValue: {
						getStatus: jest.fn(),
						markComplete: jest.fn(),
					},
				},
			],
		}).compile();

		controller = module.get<SystemController>(SystemController);
		service = module.get<SystemService>(SystemService);
		onboardingService = module.get<OnboardingService>(OnboardingService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(service).toBeDefined();
		expect(onboardingService).toBeDefined();
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

	describe('getOnboardingStatus', () => {
		it('should return onboarding status for fresh installation', async () => {
			const mockStatus = {
				hasOwner: false,
				onboardingCompleted: false,
				devicesCount: 0,
				spacesCount: 0,
				displaysCount: 0,
			};

			jest.spyOn(onboardingService, 'getStatus').mockResolvedValue(toInstance(OnboardingStatusModel, mockStatus));

			const result = await controller.getOnboardingStatus();

			expect(result.data.hasOwner).toBe(false);
			expect(result.data.onboardingCompleted).toBe(false);
			expect(result.data.devicesCount).toBe(0);
			expect(onboardingService.getStatus).toHaveBeenCalled();
		});

		it('should return onboarding status with owner', async () => {
			const mockStatus = {
				hasOwner: true,
				onboardingCompleted: false,
				devicesCount: 5,
				spacesCount: 3,
				displaysCount: 1,
			};

			jest.spyOn(onboardingService, 'getStatus').mockResolvedValue(toInstance(OnboardingStatusModel, mockStatus));

			const result = await controller.getOnboardingStatus();

			expect(result.data.hasOwner).toBe(true);
			expect(result.data.devicesCount).toBe(5);
		});
	});

	describe('completeOnboarding', () => {
		it('should mark onboarding as complete and return status', async () => {
			const mockStatus = {
				hasOwner: true,
				onboardingCompleted: true,
				devicesCount: 5,
				spacesCount: 3,
				displaysCount: 1,
			};

			jest.spyOn(onboardingService, 'markComplete').mockReturnValue(undefined);
			jest.spyOn(onboardingService, 'getStatus').mockResolvedValue(toInstance(OnboardingStatusModel, mockStatus));

			const result = await controller.completeOnboarding();

			expect(onboardingService.markComplete).toHaveBeenCalled();
			expect(result.data.onboardingCompleted).toBe(true);
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
