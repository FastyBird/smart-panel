/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { execFile } from 'node:child_process';
import si, { Systeminformation } from 'systeminformation';

import { Logger } from '@nestjs/common';
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

type ExecFileCallback = (error: Error | null, stdout?: string, stderr?: string) => void;

/** Only one command is ever probed now (`sudo -n systemd-run --scope ... /bin/true`) — `succeed` decides the single outcome. */
function mockExecFile(succeed: () => boolean, stderr = 'sudo: a password is required'): void {
	(execFile as unknown as jest.Mock).mockImplementation((...rest: unknown[]) => {
		const callback = rest[rest.length - 1] as ExecFileCallback;
		const ok = succeed();

		callback(ok ? null : new Error('probe failed'), '', ok ? '' : stderr);

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

	describe('getPrivilegedWorkerSupport / supportsPrivilegedWorkers', () => {
		beforeEach(async () => {
			// getPrivilegedWorkerSupport() now awaits the constructor's own detection promise
			// before deciding. Letting the (uncontrolled, auto-detected) constructor detection
			// settle here first means each test's manual `service['platformType'] = ...`
			// override below happens after it — and stays put, since that promise's `.then()`
			// only ever runs once.
			await service['platformDetection'];
		});

		it.each([PlatformType.DOCKER, PlatformType.HOME_ASSISTANT, PlatformType.DEVELOPMENT])(
			'returns unsupported for %s without probing sudo/systemd-run',
			async (platformType) => {
				service['platformType'] = platformType;

				await expect(service.supportsPrivilegedWorkers()).resolves.toBe(false);
				expect(execFile).not.toHaveBeenCalled();

				const support = await service.getPrivilegedWorkerSupport();

				expect(support.supported).toBe(false);
				expect(support.reason).toContain(platformType);
			},
		);

		it.each([PlatformType.DOCKER, PlatformType.HOME_ASSISTANT, PlatformType.DEVELOPMENT])(
			'reports %s as architecturally incapable via isPlatformCapableOfPrivilegedWorkers()',
			(platformType) => {
				service['platformType'] = platformType;

				expect(service.isPlatformCapableOfPrivilegedWorkers()).toBe(false);
			},
		);

		it.each([PlatformType.RASPBERRY, PlatformType.GENERIC])(
			'reports %s as architecturally capable via isPlatformCapableOfPrivilegedWorkers()',
			(platformType) => {
				service['platformType'] = platformType;

				expect(service.isPlatformCapableOfPrivilegedWorkers()).toBe(true);
			},
		);

		it('returns true for raspberry when the systemd-run scope probe succeeds', async () => {
			service['platformType'] = PlatformType.RASPBERRY;

			mockExecFile(() => true);

			await expect(service.supportsPrivilegedWorkers()).resolves.toBe(true);
			expect(execFile).toHaveBeenCalledWith(
				'sudo',
				[
					'-n',
					'systemd-run',
					'--scope',
					'--quiet',
					expect.stringMatching(/^--unit=smart-panel-privileged-probe-\d+$/),
					'/bin/true',
				],
				{ timeout: 5000 },
				expect.any(Function),
			);
		});

		it('returns true for generic when the systemd-run scope probe succeeds', async () => {
			service['platformType'] = PlatformType.GENERIC;

			mockExecFile(() => true);

			await expect(service.supportsPrivilegedWorkers()).resolves.toBe(true);
		});

		it('returns supported: true with a null reason on success', async () => {
			service['platformType'] = PlatformType.RASPBERRY;

			mockExecFile(() => true);

			const support = await service.getPrivilegedWorkerSupport();

			expect(support.supported).toBe(true);
			expect(support.reason).toBeNull();
			expect(support.checkedAt).toEqual(expect.any(String));
			expect(new Date(support.checkedAt).toString()).not.toBe('Invalid Date');
		});

		it('surfaces the probe stderr as the reason and logs it when the scope probe fails', async () => {
			service['platformType'] = PlatformType.RASPBERRY;

			const debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

			mockExecFile(() => false, 'sudo: a password is required');

			const support = await service.getPrivilegedWorkerSupport();

			expect(support.supported).toBe(false);
			expect(support.reason).toBe('sudo: a password is required');
			expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('sudo: a password is required'), expect.anything());
		});

		it('falls back to the error message when the probe fails with no stderr', async () => {
			service['platformType'] = PlatformType.RASPBERRY;

			(execFile as unknown as jest.Mock).mockImplementation((...rest: unknown[]) => {
				const callback = rest[rest.length - 1] as ExecFileCallback;

				callback(new Error('spawn sudo ENOENT'), '', '');

				return {};
			});

			const support = await service.getPrivilegedWorkerSupport();

			expect(support.supported).toBe(false);
			expect(support.reason).toBe('spawn sudo ENOENT');
		});

		it('probes only once and caches a positive result for the life of the process', async () => {
			service['platformType'] = PlatformType.RASPBERRY;

			mockExecFile(() => true);

			await service.getPrivilegedWorkerSupport();
			await service.getPrivilegedWorkerSupport();

			expect(execFile).toHaveBeenCalledTimes(1);
		});

		it('caches an unsupported-platform result forever without probing on repeated calls', async () => {
			service['platformType'] = PlatformType.DOCKER;

			await service.getPrivilegedWorkerSupport();
			await service.getPrivilegedWorkerSupport();

			expect(execFile).not.toHaveBeenCalled();
		});

		it('caches a negative result for only 60 seconds, then re-probes (so a sudoers grant added later is picked up)', async () => {
			service['platformType'] = PlatformType.RASPBERRY;

			const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);

			mockExecFile(() => false);

			const first = await service.getPrivilegedWorkerSupport();

			expect(first.supported).toBe(false);
			expect(execFile).toHaveBeenCalledTimes(1);

			// Still inside the 60s TTL — served from cache, no re-probe.
			nowSpy.mockReturnValue(1_000_000 + 59_000);

			const second = await service.getPrivilegedWorkerSupport();

			expect(second.supported).toBe(false);
			expect(execFile).toHaveBeenCalledTimes(1);

			// Past the TTL — re-probes. Simulates an administrator having added the sudoers
			// grant in between, without restarting the backend.
			nowSpy.mockReturnValue(1_000_000 + 60_001);
			mockExecFile(() => true);

			const third = await service.getPrivilegedWorkerSupport();

			expect(third.supported).toBe(true);
			expect(execFile).toHaveBeenCalledTimes(2);

			nowSpy.mockRestore();
		});

		it('waits for platform detection to finish before deciding, even when called immediately after construction', async () => {
			// No PLATFORM_TYPE_ENV override here: that path returns synchronously (before ever
			// calling si.system()), which would make the si.system() gate below inert and this
			// test would pass even without the fix. Leaving auto-detection to actually run means
			// si.system() is genuinely what construction is waiting on.
			let resolveSystemInfo!: (value: Systeminformation.SystemData) => void;

			jest.spyOn(si, 'system').mockReturnValue(
				new Promise((resolve) => {
					resolveSystemInfo = resolve;
				}),
			);
			jest.spyOn(si, 'osInfo').mockResolvedValue({ platform: 'linux', arch: 'x64' } as Systeminformation.OsData);

			const freshService = new PlatformService();

			mockExecFile(() => true);

			const resultPromise = freshService.supportsPrivilegedWorkers();

			// si.system() has not resolved yet, so autoDetectPlatform() is still awaiting it —
			// platformType is still undefined, and the probe cannot have started. On the pre-fix
			// code (reading platformType synchronously, before detection completes) this would
			// already have called execFile by this point.
			expect(freshService.getPlatformType()).toBeUndefined();
			expect(execFile).not.toHaveBeenCalled();

			resolveSystemInfo({ model: 'Generic Model', manufacturer: 'Generic' } as Systeminformation.SystemData);

			await expect(resultPromise).resolves.toBe(true);
			expect(execFile).toHaveBeenCalled();
			expect(freshService.getPlatformType()).toBe(PlatformType.GENERIC);
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
			expect(execFile).toHaveBeenCalledTimes(1);
		});
	});
});
