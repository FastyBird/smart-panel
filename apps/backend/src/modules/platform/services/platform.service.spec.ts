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
import { PLATFORM_TYPE_ENV, PlatformType } from '../platform.constants';
import { DevelopmentPlatform } from '../platforms/development.platform';
import { DockerPlatform } from '../platforms/docker.platform';
import { GenericPlatform } from '../platforms/generic.platform';
import { HomeAssistantPlatform } from '../platforms/home-assistant.platform';
import { RaspberryPlatform } from '../platforms/raspberry.platform';

import { PlatformService } from './platform.service';

describe('PlatformService', () => {
	let service: PlatformService;

	const originalEnv = process.env;

	beforeEach(async () => {
		process.env = { ...originalEnv };
		delete process.env[PLATFORM_TYPE_ENV];

		const module: TestingModule = await Test.createTestingModule({
			providers: [PlatformService],
		}).compile();

		service = module.get<PlatformService>(PlatformService);
	});

	afterEach(() => {
		jest.clearAllMocks();
		process.env = originalEnv;
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('detectPlatform (auto-detect)', () => {
		it('should detect RaspberryPlatform when running on Raspberry Pi', async () => {
			const systemInfo = { model: 'Raspberry Pi', manufacturer: 'Raspberry' } as Systeminformation.SystemData;
			const osInfo = { platform: 'linux', arch: 'arm' } as Systeminformation.OsData;

			jest.spyOn(si, 'system').mockResolvedValue(systemInfo);
			jest.spyOn(si, 'osInfo').mockResolvedValue(osInfo);

			const result = await service['detectPlatform']();

			expect(result.platform).toBeInstanceOf(RaspberryPlatform);
			expect(result.type).toBe(PlatformType.RASPBERRY);
		});

		it('should default to GenericPlatform for non-Raspberry devices', async () => {
			const systemInfo = { model: 'Generic Model', manufacturer: 'Generic' } as Systeminformation.SystemData;
			const osInfo = { platform: 'linux', arch: 'x64' } as Systeminformation.OsData;

			jest.spyOn(si, 'system').mockResolvedValue(systemInfo);
			jest.spyOn(si, 'osInfo').mockResolvedValue(osInfo);

			const result = await service['detectPlatform']();

			expect(result.platform).toBeInstanceOf(GenericPlatform);
			expect(result.type).toBe(PlatformType.GENERIC);
		});

		it('should handle errors and throw', async () => {
			jest.spyOn(si, 'system').mockRejectedValue(new Error('System info error'));

			await expect(service['detectPlatform']()).rejects.toThrow('System info error');
		});
	});

	describe('detectPlatform (env var override)', () => {
		it('should use DockerPlatform when PLATFORM_TYPE=docker', async () => {
			process.env[PLATFORM_TYPE_ENV] = 'docker';

			const result = await service['detectPlatform']();

			expect(result.platform).toBeInstanceOf(DockerPlatform);
			expect(result.type).toBe(PlatformType.DOCKER);
		});

		it('should use DevelopmentPlatform when PLATFORM_TYPE=development', async () => {
			process.env[PLATFORM_TYPE_ENV] = 'development';

			const result = await service['detectPlatform']();

			expect(result.platform).toBeInstanceOf(DevelopmentPlatform);
			expect(result.type).toBe(PlatformType.DEVELOPMENT);
		});

		it('should use HomeAssistantPlatform when PLATFORM_TYPE=home-assistant', async () => {
			process.env[PLATFORM_TYPE_ENV] = 'home-assistant';

			const result = await service['detectPlatform']();

			expect(result.platform).toBeInstanceOf(HomeAssistantPlatform);
			expect(result.type).toBe(PlatformType.HOME_ASSISTANT);
		});

		it('should use RaspberryPlatform when PLATFORM_TYPE=raspberry', async () => {
			process.env[PLATFORM_TYPE_ENV] = 'raspberry';

			const result = await service['detectPlatform']();

			expect(result.platform).toBeInstanceOf(RaspberryPlatform);
			expect(result.type).toBe(PlatformType.RASPBERRY);
		});

		it('should use GenericPlatform when PLATFORM_TYPE=generic', async () => {
			process.env[PLATFORM_TYPE_ENV] = 'generic';

			const result = await service['detectPlatform']();

			expect(result.platform).toBeInstanceOf(GenericPlatform);
			expect(result.type).toBe(PlatformType.GENERIC);
		});

		it('should fall back to auto-detection for unknown PLATFORM_TYPE value', async () => {
			process.env[PLATFORM_TYPE_ENV] = 'unknown-platform';

			const systemInfo = { model: 'Generic Model', manufacturer: 'Generic' } as Systeminformation.SystemData;
			const osInfo = { platform: 'linux', arch: 'x64' } as Systeminformation.OsData;

			jest.spyOn(si, 'system').mockResolvedValue(systemInfo);
			jest.spyOn(si, 'osInfo').mockResolvedValue(osInfo);

			const result = await service['detectPlatform']();

			expect(result.platform).toBeInstanceOf(GenericPlatform);
			expect(result.type).toBe(PlatformType.GENERIC);
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
