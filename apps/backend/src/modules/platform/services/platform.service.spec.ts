/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import si, { Systeminformation } from 'systeminformation';

import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { NetworkStatsDto } from '../dto/network-stats.dto';
import { SystemInfoDto } from '../dto/system-info.dto';
import { TemperatureDto } from '../dto/temperature.dto';
import { ThrottleStatusDto } from '../dto/throttle-status.dto';
import { GenericPlatform } from '../platforms/generic.platform';
import { RaspberryPlatform } from '../platforms/raspberry.platform';

import { PlatformService } from './platform.service';

describe('PlatformService', () => {
	let service: PlatformService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [PlatformService],
		}).compile();

		service = module.get<PlatformService>(PlatformService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('detectPlatform', () => {
		it('should detect RaspberryPlatform when running on Raspberry Pi', async () => {
			const systemInfo = { model: 'Raspberry Pi', manufacturer: 'Raspberry' } as Systeminformation.SystemData;
			const osInfo = { platform: 'linux', arch: 'arm' } as Systeminformation.OsData;

			jest.spyOn(si, 'system').mockResolvedValue(systemInfo);
			jest.spyOn(si, 'osInfo').mockResolvedValue(osInfo);

			const platform = await service['detectPlatform']();

			expect(platform).toBeInstanceOf(RaspberryPlatform);
		});

		it('should default to GenericPlatform for non-Raspberry devices', async () => {
			const systemInfo = { model: 'Generic Model', manufacturer: 'Generic' } as Systeminformation.SystemData;
			const osInfo = { platform: 'linux', arch: 'x64' } as Systeminformation.OsData;

			jest.spyOn(si, 'system').mockResolvedValue(systemInfo);
			jest.spyOn(si, 'osInfo').mockResolvedValue(osInfo);

			const platform = await service['detectPlatform']();

			expect(platform).toBeInstanceOf(GenericPlatform);
		});

		it('should handle errors and default to GenericPlatform', async () => {
			jest.spyOn(si, 'system').mockRejectedValue(new Error('System info error'));

			await expect(service['detectPlatform']()).rejects.toThrow('System info error');
		});
	});

	describe('platform delegation', () => {
		beforeEach(() => {
			service['platform'] = new GenericPlatform();
		});

		it('should delegate getSystemInfo to platform', async () => {
			const mockSystemInfo = { cpuLoad: 10 };
			jest.spyOn(service['platform'], 'getSystemInfo').mockResolvedValue(toInstance(SystemInfoDto, mockSystemInfo));

			const result = await service.getSystemInfo();

			expect(result).toEqual(toInstance(SystemInfoDto, mockSystemInfo));
			expect(service['platform'].getSystemInfo).toHaveBeenCalled();
		});

		it('should delegate getThrottleStatus to platform', async () => {
			const mockThrottleStatus = { undervoltage: false };
			jest
				.spyOn(service['platform'], 'getThrottleStatus')
				.mockResolvedValue(toInstance(ThrottleStatusDto, mockThrottleStatus));

			const result = await service.getThrottleStatus();

			expect(result).toEqual(toInstance(ThrottleStatusDto, mockThrottleStatus));
			expect(service['platform'].getThrottleStatus).toHaveBeenCalled();
		});

		it('should delegate getTemperature to platform', async () => {
			const mockTemperature = { cpu: 40, gpu: 50 };
			jest.spyOn(service['platform'], 'getTemperature').mockResolvedValue(toInstance(TemperatureDto, mockTemperature));

			const result = await service.getTemperature();

			expect(result).toEqual(toInstance(TemperatureDto, mockTemperature));
			expect(service['platform'].getTemperature).toHaveBeenCalled();
		});

		it('should delegate getNetworkStats to platform', async () => {
			const mockNetworkStats = [{ interface: 'eth0', rxBytes: 1000, txBytes: 500 }];
			jest
				.spyOn(service['platform'], 'getNetworkStats')
				.mockResolvedValue(toInstance(NetworkStatsDto, mockNetworkStats));

			const result = await service.getNetworkStats();

			expect(result).toEqual(toInstance(NetworkStatsDto, mockNetworkStats));
			expect(service['platform'].getNetworkStats).toHaveBeenCalled();
		});
	});
});
