/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { execFile } from 'node:child_process';

import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../../modules/config/services/config.service';
import { PlatformType } from '../../../modules/platform/platform.constants';
import { PlatformService } from '../../../modules/platform/services/platform.service';
import { EventType as RemoteAccessEventType } from '../../../modules/remote-access/remote-access.constants';
import { RemoteAccessCloudflareTunnelPluginConfigModel } from '../models/config.model';
import { CLOUDFLARED_READY_GRACE_MS } from '../remote-access-cloudflare-tunnel.constants';

import { CloudflareTunnelManagedService, compareCloudflaredVersions } from './cloudflare-tunnel-managed.service';
import { CloudflaredCliError, CloudflaredCliService } from './cloudflared-cli.service';
import { CloudflaredMetricsService } from './cloudflared-metrics.service';
import { CloudflaredProcessService } from './cloudflared-process.service';

jest.mock('node:child_process', () => ({
	...jest.requireActual<typeof import('node:child_process')>('node:child_process'),
	execFile: jest.fn(),
}));

const DEFAULT_PRINT_PLAN_STDOUT =
	'curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null\napt-get install -y -qq --no-install-recommends cloudflared\n';

function mockPrintPlan(stdout: string = DEFAULT_PRINT_PLAN_STDOUT): void {
	(execFile as unknown as jest.Mock).mockImplementation(
		(_file: string, _args: string[], _options: unknown, callback: (error: Error | null, stdout?: string) => void) => {
			callback(null, stdout);

			return {};
		},
	);
}

function expectRequirements(
	requirements: { code: string; satisfied: boolean; message: string }[],
	expected: { code: string; satisfied: boolean }[],
): void {
	expect(requirements.map(({ code, satisfied }) => ({ code, satisfied }))).toEqual(expected);
	expect(
		requirements.every((requirement) => typeof requirement.message === 'string' && requirement.message.length > 0),
	).toBe(true);
}

describe('CloudflareTunnelManagedService', () => {
	let service: CloudflareTunnelManagedService;
	let cliService: { getVersion: jest.Mock };
	let processService: {
		isRunning: jest.Mock;
		getStartedAt: jest.Mock;
		getLastExit: jest.Mock;
		getLastStderrLine: jest.Mock;
		start: jest.Mock;
		stop: jest.Mock;
	};
	let metricsService: { fetchReady: jest.Mock };
	let configServiceMock: { getPluginConfig: jest.Mock };
	let nestConfigServiceMock: { get: jest.Mock };
	let platformServiceMock: { getPlatformTypeAsync: jest.Mock };
	let eventEmitterMock: { emit: jest.Mock };

	const defaultConfig = (): RemoteAccessCloudflareTunnelPluginConfigModel => {
		const config = new RemoteAccessCloudflareTunnelPluginConfigModel();
		config.publicHostname = null;
		config.protocol = 'auto';
		config.tunnelToken = 'a-real-token';

		return config;
	};

	beforeEach(async () => {
		jest.useFakeTimers();
		mockPrintPlan();

		cliService = {
			getVersion: jest.fn().mockResolvedValue({ version: '2024.6.1', raw: 'cloudflared version 2024.6.1' }),
		};
		processService = {
			isRunning: jest.fn().mockReturnValue(false),
			getStartedAt: jest.fn().mockReturnValue(null),
			getLastExit: jest.fn().mockReturnValue(null),
			getLastStderrLine: jest.fn().mockReturnValue(null),
			start: jest.fn(),
			stop: jest.fn().mockResolvedValue(undefined),
		};
		metricsService = { fetchReady: jest.fn().mockResolvedValue(null) };
		configServiceMock = { getPluginConfig: jest.fn().mockReturnValue(defaultConfig()) };
		nestConfigServiceMock = { get: jest.fn().mockReturnValue(undefined) };
		platformServiceMock = { getPlatformTypeAsync: jest.fn().mockResolvedValue(PlatformType.RASPBERRY) };
		eventEmitterMock = { emit: jest.fn() };

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CloudflareTunnelManagedService,
				{ provide: CloudflaredCliService, useValue: cliService },
				{ provide: CloudflaredProcessService, useValue: processService },
				{ provide: CloudflaredMetricsService, useValue: metricsService },
				{ provide: ConfigService, useValue: configServiceMock },
				{ provide: NestConfigService, useValue: nestConfigServiceMock },
				{ provide: PlatformService, useValue: platformServiceMock },
				{ provide: EventEmitter2, useValue: eventEmitterMock },
			],
		}).compile();

		service = module.get(CloudflareTunnelManagedService);
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('compareCloudflaredVersions', () => {
		it('compares CalVer-style versions numerically, not lexicographically', () => {
			expect(compareCloudflaredVersions('2024.10.0', '2024.9.0')).toBeGreaterThan(0);
			expect(compareCloudflaredVersions('2024.1.0', '2024.1.0')).toBe(0);
			expect(compareCloudflaredVersions('2023.12.0', '2024.1.0')).toBeLessThan(0);
		});
	});

	describe('requirements matrix', () => {
		it('reports every requirement satisfied on a fully-prepared installation', async () => {
			const requirements = await service.refreshRequirements();

			expectRequirements(requirements, [
				{ code: 'platform-supported', satisfied: true },
				{ code: 'binary-installed', satisfied: true },
				{ code: 'version-supported', satisfied: true },
				{ code: 'token-configured', satisfied: true },
			]);
			expect(requirements.every((requirement) => requirement.remedy === null)).toBe(true);
		});

		it('short-circuits the other three as unevaluated when the platform is unsupported', async () => {
			platformServiceMock.getPlatformTypeAsync.mockResolvedValue(PlatformType.DOCKER);

			const requirements = await service.refreshRequirements();

			expectRequirements(requirements, [
				{ code: 'platform-supported', satisfied: false },
				{ code: 'binary-installed', satisfied: false },
				{ code: 'version-supported', satisfied: false },
				{ code: 'token-configured', satisfied: false },
			]);

			const platform = requirements.find((requirement) => requirement.code === 'platform-supported');

			expect(platform?.remedy?.commands).toEqual([]);
			expect(platform?.remedy?.note).toContain('https://');
		});

		it('reports binary-installed/version-supported unsatisfied when cloudflared is missing, independent of the token', async () => {
			cliService.getVersion.mockRejectedValue(new CloudflaredCliError('not-installed', 'not installed'));

			const requirements = await service.refreshRequirements();

			expectRequirements(requirements, [
				{ code: 'platform-supported', satisfied: true },
				{ code: 'binary-installed', satisfied: false },
				{ code: 'version-supported', satisfied: false },
				{ code: 'token-configured', satisfied: true },
			]);
		});

		it('builds the binary-installed/version-supported remedy from cloudflared-setup.sh --print-plan, sudo-prefixing plain lines only', async () => {
			cliService.getVersion.mockRejectedValue(new CloudflaredCliError('not-installed', 'not installed'));
			mockPrintPlan(
				'curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null\napt-get update -qq\napt-get install -y -qq --no-install-recommends cloudflared\n',
			);

			const requirements = await service.refreshRequirements();
			const binary = requirements.find((requirement) => requirement.code === 'binary-installed');

			expect(binary?.remedy).toEqual({
				commands: [
					'curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null',
					'sudo apt-get update -qq',
					'sudo apt-get install -y -qq --no-install-recommends cloudflared',
				],
				note: null,
			});
		});

		it('falls back to the vendor download link when --print-plan prints nothing (unsupported distro)', async () => {
			cliService.getVersion.mockRejectedValue(new CloudflaredCliError('not-installed', 'not installed'));
			mockPrintPlan('');

			const requirements = await service.refreshRequirements();
			const binary = requirements.find((requirement) => requirement.code === 'binary-installed');

			expect(binary?.remedy?.commands).toEqual([]);
			expect(binary?.remedy?.note).toContain('https://pkg.cloudflare.com');
		});

		it('reports version-supported unsatisfied for a too-old cloudflared, independent of binary-installed/token', async () => {
			cliService.getVersion.mockResolvedValue({ version: '2023.1.0', raw: 'cloudflared version 2023.1.0' });

			const requirements = await service.refreshRequirements();

			expectRequirements(requirements, [
				{ code: 'platform-supported', satisfied: true },
				{ code: 'binary-installed', satisfied: true },
				{ code: 'version-supported', satisfied: false },
				{ code: 'token-configured', satisfied: true },
			]);
		});

		it('reports token-configured unsatisfied with the exact wizard message, independent of the other requirements', async () => {
			configServiceMock.getPluginConfig.mockReturnValue(
				Object.assign(defaultConfig(), { tunnelToken: null }) as RemoteAccessCloudflareTunnelPluginConfigModel,
			);

			const requirements = await service.refreshRequirements();
			const token = requirements.find((requirement) => requirement.code === 'token-configured');

			expect(token).toMatchObject({
				satisfied: false,
				message: 'Paste the tunnel token from the Cloudflare Zero Trust dashboard',
				remedy: { commands: [], note: 'Paste the tunnel token in the setup wizard' },
			});
		});

		it('treats a blank (whitespace-only) tunnel token the same as absent', async () => {
			configServiceMock.getPluginConfig.mockReturnValue(
				Object.assign(defaultConfig(), { tunnelToken: '   ' }) as RemoteAccessCloudflareTunnelPluginConfigModel,
			);

			const requirements = await service.refreshRequirements();
			const token = requirements.find((requirement) => requirement.code === 'token-configured');

			expect(token?.satisfied).toBe(false);
		});
	});

	describe('computeStatus() state map', () => {
		it('reports unsupported when the platform is not eligible', async () => {
			platformServiceMock.getPlatformTypeAsync.mockResolvedValue(PlatformType.DOCKER);
			await service.start();

			const status = await service.computeStatus();

			expect(status.state).toBe('unsupported');
		});

		it('reports not-installed when the binary is missing', async () => {
			cliService.getVersion.mockRejectedValue(new CloudflaredCliError('not-installed', 'not installed'));
			await service.start();

			const status = await service.computeStatus();

			expect(status.state).toBe('not-installed');
		});

		it('reports not-installed when the installed version is too old', async () => {
			cliService.getVersion.mockResolvedValue({ version: '2023.1.0', raw: 'cloudflared version 2023.1.0' });
			await service.start();

			const status = await service.computeStatus();

			expect(status.state).toBe('not-installed');
			expect(status.advisories).toEqual(
				expect.arrayContaining([expect.objectContaining({ code: 'version-unsupported', severity: 'warning' })]),
			);
		});

		it('reports setup-required with the exact message when no token is configured', async () => {
			configServiceMock.getPluginConfig.mockReturnValue(
				Object.assign(defaultConfig(), { tunnelToken: null }) as RemoteAccessCloudflareTunnelPluginConfigModel,
			);
			await service.start();

			const status = await service.computeStatus();

			expect(status.state).toBe('setup-required');
			expect(status.message).toBe('Paste the tunnel token from the Cloudflare Zero Trust dashboard');
		});

		it('reports disconnected once the service is stopped, with no endpoints/proxyAddresses', async () => {
			await service.start();
			processService.isRunning.mockReturnValue(true);
			metricsService.fetchReady.mockResolvedValue({ readyConnections: 1, connectorId: 'abc' });
			await service.stop();

			const status = await service.computeStatus();

			expect(status).toMatchObject({ state: 'disconnected', endpoints: [], proxyAddresses: [] });
		});

		it('reports connecting when the process is running but /ready is unreachable/503, inside the grace window', async () => {
			await service.start();
			processService.isRunning.mockReturnValue(true);
			processService.getStartedAt.mockReturnValue(Date.now());
			metricsService.fetchReady.mockResolvedValue(null);

			const status = await service.computeStatus();

			expect(status.state).toBe('connecting');
		});

		it('reports error once the ready grace is exceeded without success', async () => {
			await service.start();
			processService.isRunning.mockReturnValue(true);
			processService.getStartedAt.mockReturnValue(Date.now() - CLOUDFLARED_READY_GRACE_MS - 1);
			metricsService.fetchReady.mockResolvedValue(null);

			const status = await service.computeStatus();

			expect(status.state).toBe('error');
		});

		it('uses the last redacted stderr line as the error message when the grace is exceeded and stderr is available', async () => {
			await service.start();
			processService.isRunning.mockReturnValue(true);
			processService.getStartedAt.mockReturnValue(Date.now() - CLOUDFLARED_READY_GRACE_MS - 1);
			metricsService.fetchReady.mockResolvedValue(null);
			processService.getLastStderrLine.mockReturnValue('failed to register tunnel: ***redacted***');

			const status = await service.computeStatus();

			expect(status.message).toBe('failed to register tunnel: ***redacted***');
		});

		it('reports connected with endpoints, proxyAddresses and details when /ready succeeds', async () => {
			configServiceMock.getPluginConfig.mockReturnValue(
				Object.assign(defaultConfig(), {
					publicHostname: 'panel.example.com',
				}) as RemoteAccessCloudflareTunnelPluginConfigModel,
			);
			await service.start();
			processService.isRunning.mockReturnValue(true);
			metricsService.fetchReady.mockResolvedValue({ readyConnections: 3, connectorId: 'conn-1' });

			const status = await service.computeStatus();

			expect(status.state).toBe('connected');
			expect(status.endpoints).toEqual([
				{ url: 'https://panel.example.com', scope: 'public', https: true, label: 'Cloudflare Tunnel' },
			]);
			expect(status.proxyAddresses).toEqual(['127.0.0.1', '::1']);
			expect(status.details).toMatchObject({
				hostname: 'panel.example.com',
				connector_id: 'conn-1',
				ready_connections: 3,
				version: '2024.6.1',
			});
			expect(status.advisories).toEqual(
				expect.arrayContaining([expect.objectContaining({ code: 'public-exposure', severity: 'warning' })]),
			);
		});

		it('adds the hostname-not-configured advisory when connected without a public hostname', async () => {
			await service.start();
			processService.isRunning.mockReturnValue(true);
			metricsService.fetchReady.mockResolvedValue({ readyConnections: 1, connectorId: 'conn-1' });

			const status = await service.computeStatus();

			expect(status.state).toBe('connected');
			expect(status.advisories).toEqual(
				expect.arrayContaining([expect.objectContaining({ code: 'hostname-not-configured', severity: 'info' })]),
			);
		});

		it('reports error when the process is not running despite every requirement being satisfied (unexpected exit)', async () => {
			await service.start();
			processService.isRunning.mockReturnValue(false);
			processService.getLastExit.mockReturnValue({ code: 1, signal: null });
			processService.getLastStderrLine.mockReturnValue('fatal error: could not connect');

			const status = await service.computeStatus();

			expect(status.state).toBe('error');
			expect(status.message).toBe('fatal error: could not connect');
		});

		it('reports the recorded lastError while the service itself is in the error state', async () => {
			processService.stop.mockRejectedValue(new Error('refused to die'));
			await service.start();

			await expect(service.stop()).rejects.toThrow('refused to die');

			const status = await service.computeStatus();

			expect(status).toMatchObject({ state: 'error', message: 'refused to die' });
		});
	});

	describe('start()/stop()', () => {
		it('spawns the cloudflared process with the token, protocol and metrics address when every requirement is satisfied', async () => {
			configServiceMock.getPluginConfig.mockReturnValue(
				Object.assign(defaultConfig(), { protocol: 'quic' }) as RemoteAccessCloudflareTunnelPluginConfigModel,
			);

			await service.start();

			expect(processService.start).toHaveBeenCalledWith({
				token: 'a-real-token',
				protocol: 'quic',
				metricsAddress: '127.0.0.1:20246',
			});
		});

		it('never spawns the process when a requirement is unsatisfied (self-healing, matches D3)', async () => {
			configServiceMock.getPluginConfig.mockReturnValue(
				Object.assign(defaultConfig(), { tunnelToken: null }) as RemoteAccessCloudflareTunnelPluginConfigModel,
			);

			await service.start();

			expect(processService.start).not.toHaveBeenCalled();
		});

		it('stops the child process and transitions to stopped', async () => {
			await service.start();

			await service.stop();

			expect(processService.stop).toHaveBeenCalled();
			expect(service.getState()).toBe('stopped');
		});

		it('emits PROVIDER_STATUS on stop()', async () => {
			await service.start();
			eventEmitterMock.emit.mockClear();

			await service.stop();

			expect(eventEmitterMock.emit).toHaveBeenCalledWith(
				RemoteAccessEventType.PROVIDER_STATUS,
				expect.objectContaining({ state: 'disconnected' }),
			);
		});

		it('transitions to error and throws when stopping the process fails', async () => {
			processService.stop.mockRejectedValue(new Error('stuck'));
			await service.start();

			await expect(service.stop()).rejects.toThrow('stuck');

			expect(service.getState()).toBe('error');
		});
	});

	describe('onConfigChanged()', () => {
		it('requires a restart when the tunnel token changes', async () => {
			await service.start();

			configServiceMock.getPluginConfig.mockReturnValue(
				Object.assign(defaultConfig(), { tunnelToken: 'a-new-token' }) as RemoteAccessCloudflareTunnelPluginConfigModel,
			);

			const result = await service.onConfigChanged();

			expect(result).toEqual({ restartRequired: true });
		});

		it('requires a restart when the protocol changes', async () => {
			await service.start();

			configServiceMock.getPluginConfig.mockReturnValue(
				Object.assign(defaultConfig(), { protocol: 'http2' }) as RemoteAccessCloudflareTunnelPluginConfigModel,
			);

			const result = await service.onConfigChanged();

			expect(result).toEqual({ restartRequired: true });
		});

		it('does not require a restart for a hostname-only change', async () => {
			await service.start();

			configServiceMock.getPluginConfig.mockReturnValue(
				Object.assign(defaultConfig(), {
					publicHostname: 'panel.example.com',
				}) as RemoteAccessCloudflareTunnelPluginConfigModel,
			);

			const result = await service.onConfigChanged();

			expect(result).toEqual({ restartRequired: false });
		});
	});

	describe('isHealthy()', () => {
		it('is false when the process is not running', async () => {
			processService.isRunning.mockReturnValue(false);

			expect(await service.isHealthy()).toBe(false);
		});

		it('is true when the process is running and /ready succeeds', async () => {
			processService.isRunning.mockReturnValue(true);
			metricsService.fetchReady.mockResolvedValue({ readyConnections: 1, connectorId: 'x' });

			expect(await service.isHealthy()).toBe(true);
		});

		it('is false when the process is running but /ready fails', async () => {
			processService.isRunning.mockReturnValue(true);
			metricsService.fetchReady.mockResolvedValue(null);

			expect(await service.isHealthy()).toBe(false);
		});
	});

	describe('factoryReset()', () => {
		it('stops the process and reports success', async () => {
			await service.start();

			const result = await service.factoryReset();

			expect(processService.stop).toHaveBeenCalled();
			expect(result).toEqual({ success: true });
		});

		it('reports failure with the error reason when stopping fails', async () => {
			// Started first: factoryReset() now goes through the full stop() lifecycle, which
			// no-ops (never touching processService.stop()) while already 'stopped' — the
			// default state before start() has ever run.
			await service.start();
			processService.stop.mockRejectedValue(new Error('kill failed'));

			const result = await service.factoryReset();

			expect(result).toEqual({ success: false, reason: 'kill failed' });
		});

		it('stops the managed service (not just the process), so a pending poll tick cannot respawn cloudflared afterwards', async () => {
			await service.start();

			await service.factoryReset();

			processService.isRunning.mockReturnValue(false);
			processService.start.mockClear();

			// factoryReset() -> stop() clears the poll timer entirely, so there is no pending
			// tick left to fire at all — advancing time proves nothing tries to respawn it.
			await jest.advanceTimersByTimeAsync(30_000);

			expect(processService.start).not.toHaveBeenCalled();
		});
	});

	describe('poller self-healing', () => {
		it('respawns the process on the next tick after an unexpected crash, while every requirement stays satisfied', async () => {
			await service.start();
			processService.isRunning.mockReturnValue(false);
			processService.start.mockClear();

			await jest.advanceTimersByTimeAsync(30_000);

			expect(processService.start).toHaveBeenCalledWith({
				token: 'a-real-token',
				protocol: 'auto',
				metricsAddress: '127.0.0.1:20246',
			});
		});

		it('does not respawn while a requirement is unsatisfied', async () => {
			await service.start();
			processService.isRunning.mockReturnValue(false);
			processService.start.mockClear();

			// The managed service caches `getPluginConfig()`'s return value after start(), so
			// swapping the mock's return value here would have no effect — mutate the
			// already-cached object in place instead, reflecting a token cleared by a later,
			// unrelated request (e.g. POST /reset) without going through onConfigChanged().
			const cachedConfig = configServiceMock.getPluginConfig.mock.results[0]
				.value as RemoteAccessCloudflareTunnelPluginConfigModel;
			cachedConfig.tunnelToken = null;

			await jest.advanceTimersByTimeAsync(30_000);

			expect(processService.start).not.toHaveBeenCalled();
		});
	});
});
