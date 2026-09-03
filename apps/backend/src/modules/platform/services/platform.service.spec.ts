/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { execFile } from 'node:child_process';
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

// Only execFile is replaced — other exports (execSync, spawn, ...) stay real so the
// platform strategy classes imported above keep working outside the tests that need this.
jest.mock('node:child_process', () => ({
	...jest.requireActual<typeof import('node:child_process')>('node:child_process'),
	execFile: jest.fn(),
}));

type ExecFileCallback = (error: Error | null) => void;

function mockExecFile(resolve: (file: string) => boolean): void {
	(execFile as unknown as jest.Mock).mockImplementation((file: string, ...rest: unknown[]) => {
		const callback = rest[rest.length - 1] as ExecFileCallback;

		callback(resolve(file) ? null : new Error(`${file} probe failed`));

		return {};
	});
}

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

	describe('supportsPrivilegedWorkers', () => {
		beforeEach(async () => {
			// supportsPrivilegedWorkers() now awaits the constructor's own detection promise
			// before deciding. Letting the (uncontrolled, auto-detected) constructor detection
			// settle here first means each test's manual `service['platformType'] = ...`
			// override below happens after it — and stays put, since that promise's `.then()`
			// only ever runs once.
			await service['platformDetection'];
		});

		it.each([PlatformType.DOCKER, PlatformType.HOME_ASSISTANT, PlatformType.DEVELOPMENT])(
			'returns false for %s without probing sudo/systemd-run',
			async (platformType) => {
				service['platformType'] = platformType;

				await expect(service.supportsPrivilegedWorkers()).resolves.toBe(false);
				expect(execFile).not.toHaveBeenCalled();
			},
		);

		it('returns true for raspberry when passwordless sudo and systemd-run are both available', async () => {
			service['platformType'] = PlatformType.RASPBERRY;

			mockExecFile(() => true);

			await expect(service.supportsPrivilegedWorkers()).resolves.toBe(true);
			expect(execFile).toHaveBeenCalledWith('sudo', ['-n', '/usr/bin/true'], { timeout: 2000 }, expect.any(Function));
			expect(execFile).toHaveBeenCalledWith('which', ['systemd-run'], { timeout: 2000 }, expect.any(Function));
		});

		it('returns true for generic when passwordless sudo and systemd-run are both available', async () => {
			service['platformType'] = PlatformType.GENERIC;

			mockExecFile(() => true);

			await expect(service.supportsPrivilegedWorkers()).resolves.toBe(true);
		});

		it('returns false when passwordless sudo is unavailable', async () => {
			service['platformType'] = PlatformType.RASPBERRY;

			mockExecFile((file) => file !== 'sudo');

			await expect(service.supportsPrivilegedWorkers()).resolves.toBe(false);
		});

		it('returns false when systemd-run is not on PATH', async () => {
			service['platformType'] = PlatformType.RASPBERRY;

			mockExecFile((file) => file !== 'which');

			await expect(service.supportsPrivilegedWorkers()).resolves.toBe(false);
		});

		it('probes only once and caches the result across repeated calls', async () => {
			service['platformType'] = PlatformType.RASPBERRY;

			mockExecFile(() => true);

			await service.supportsPrivilegedWorkers();
			await service.supportsPrivilegedWorkers();

			expect(execFile).toHaveBeenCalledTimes(2); // one sudo + one systemd-run probe, first call only
		});

		it('caches a false result for an unsupported platform without probing on repeated calls', async () => {
			service['platformType'] = PlatformType.DOCKER;

			await service.supportsPrivilegedWorkers();
			await service.supportsPrivilegedWorkers();

			expect(execFile).not.toHaveBeenCalled();
		});

		it('waits for platform detection to finish before deciding, even when called immediately after construction', async () => {
			let resolveSystemInfo!: (value: Systeminformation.SystemData) => void;

			jest.spyOn(si, 'system').mockReturnValue(
				new Promise((resolve) => {
					resolveSystemInfo = resolve;
				}),
			);
			jest.spyOn(si, 'osInfo').mockResolvedValue({ platform: 'linux', arch: 'x64' } as Systeminformation.OsData);
			process.env[PLATFORM_TYPE_ENV] = 'docker';

			const freshService = new PlatformService();

			// If a real ENOENT-class failure would let sudo/systemd-run succeed, this would
			// wrongly resolve `true` on the pre-fix code path, which reads platformType before
			// detection has assigned it.
			mockExecFile(() => true);

			const resultPromise = freshService.supportsPrivilegedWorkers();

			// Detection has not resolved yet — platformType is still undefined at this point.
			expect(freshService.getPlatformType()).toBeUndefined();

			resolveSystemInfo({ model: 'Generic Model', manufacturer: 'Generic' } as Systeminformation.SystemData);

			await expect(resultPromise).resolves.toBe(false);
			expect(execFile).not.toHaveBeenCalled();
			expect(freshService.getPlatformType()).toBe(PlatformType.DOCKER);
		});

		it('shares a single in-flight probe between concurrent first callers', async () => {
			service['platformType'] = PlatformType.RASPBERRY;

			mockExecFile(() => true);

			const [first, second] = await Promise.all([
				service.supportsPrivilegedWorkers(),
				service.supportsPrivilegedWorkers(),
			]);

			expect(first).toBe(true);
			expect(second).toBe(true);
			expect(execFile).toHaveBeenCalledTimes(2); // one sudo + one systemd-run probe, shared
		});
	});
});
