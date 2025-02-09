/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import si, { Systeminformation } from 'systeminformation';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { SystemInfoDto } from '../dto/system-info.dto';
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
			jest.spyOn(service['platform'], 'getSystemInfo').mockResolvedValue(mockSystemInfo as SystemInfoDto);

			const result = await service.getSystemInfo();

			expect(result).toEqual(mockSystemInfo);
			expect(service['platform'].getSystemInfo).toHaveBeenCalled();
		});

		it('should delegate getThrottleStatus to platform', async () => {
			const mockThrottleStatus = { undervoltage: false };
			jest.spyOn(service['platform'], 'getThrottleStatus').mockResolvedValue(mockThrottleStatus as ThrottleStatusDto);

			const result = await service.getThrottleStatus();

			expect(result).toEqual(mockThrottleStatus);
			expect(service['platform'].getThrottleStatus).toHaveBeenCalled();
		});

		it('should delegate getTemperature to platform', async () => {
			const mockTemperature = { cpu: 40, gpu: 50 };
			jest.spyOn(service['platform'], 'getTemperature').mockResolvedValue(mockTemperature);

			const result = await service.getTemperature();

			expect(result).toEqual(mockTemperature);
			expect(service['platform'].getTemperature).toHaveBeenCalled();
		});

		it('should delegate getNetworkStats to platform', async () => {
			const mockNetworkStats = [{ interface: 'eth0', rxBytes: 1000, txBytes: 500 }];
			jest.spyOn(service['platform'], 'getNetworkStats').mockResolvedValue(mockNetworkStats);

			const result = await service.getNetworkStats();

			expect(result).toEqual(mockNetworkStats);
			expect(service['platform'].getNetworkStats).toHaveBeenCalled();
		});
	});
});
