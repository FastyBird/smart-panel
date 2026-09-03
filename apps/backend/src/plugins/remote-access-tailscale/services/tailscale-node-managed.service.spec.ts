/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { execFile } from 'node:child_process';
import os from 'os';

import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../../modules/config/services/config.service';
import { PlatformType } from '../../../modules/platform/platform.constants';
import { PlatformService } from '../../../modules/platform/services/platform.service';
import { RemoteAccessProviderStatus } from '../../../modules/remote-access/platforms/remote-access-provider.platform';
import { EventType as RemoteAccessEventType } from '../../../modules/remote-access/remote-access.constants';
import { RemoteAccessTailscalePluginConfigModel } from '../models/config.model';
import { REMOTE_ACCESS_TAILSCALE_ALLOW_DEV_ENV } from '../remote-access-tailscale.constants';

import { TailscaleCliError, TailscaleCliService, TailscaleStatus } from './tailscale-cli.service';
import { TailscaleNodeManagedService, compareTailscaleVersions } from './tailscale-node-managed.service';
import { TailscaleStatusMapperService } from './tailscale-status-mapper.service';

jest.mock('node:child_process', () => ({
	...jest.requireActual<typeof import('node:child_process')>('node:child_process'),
	execFile: jest.fn(),
}));

/** Controls the `systemctl is-active tailscaled` probe result. */
function mockSystemctlActive(active: boolean): void {
	(execFile as unknown as jest.Mock).mockImplementation(
		(_file: string, _args: string[], _options: unknown, callback: (error: Error | null, stdout?: string) => void) => {
			if (active) {
				callback(null, 'active\n');
			} else {
				const error: Error & { code?: number } = new Error('Command failed');
				error.code = 3;
				callback(error, 'inactive\n');
			}

			return {};
		},
	);
}

const RUNNING_CONNECTED_STATUS: TailscaleStatus = {
	BackendState: 'Running',
	Self: { Online: true, TailscaleIPs: ['100.64.0.5'], DNSName: 'panel.tailc0ffee.ts.net.' },
	CurrentTailnet: { Name: 'example.ts.net', MagicDNSEnabled: false },
	Version: '1.78.1',
};

const STOPPED_STATUS: TailscaleStatus = { BackendState: 'Stopped' };

const TAILSCALE_STABLE_INTERVAL = 30_000;

/**
 * Asserts the requirement list's codes/satisfied flags exactly (order and
 * length included) and, separately, that every message is a non-empty
 * string — split out because `expect.any(String)` inside a plain object
 * literal trips `@typescript-eslint/no-unsafe-assignment`.
 */
function expectRequirements(
	requirements: { code: string; satisfied: boolean; message: string }[],
	expected: { code: string; satisfied: boolean }[],
): void {
	expect(requirements.map(({ code, satisfied }) => ({ code, satisfied }))).toEqual(expected);
	expect(
		requirements.every((requirement) => typeof requirement.message === 'string' && requirement.message.length > 0),
	).toBe(true);
}

describe('TailscaleNodeManagedService', () => {
	let service: TailscaleNodeManagedService;
	let cli: {
		getVersion: jest.Mock;
		getStatus: jest.Mock;
		up: jest.Mock;
		set: jest.Mock;
		down: jest.Mock;
		logout: jest.Mock;
		serveReset: jest.Mock;
	};
	let configServiceMock: { getPluginConfig: jest.Mock };
	let nestConfigServiceMock: { get: jest.Mock };
	let platformServiceMock: { getPlatformType: jest.Mock };
	let eventEmitterMock: { emit: jest.Mock };

	const defaultConfig = (): RemoteAccessTailscalePluginConfigModel => {
		const config = new RemoteAccessTailscalePluginConfigModel();
		config.hostname = 'smart-panel';
		config.loginServer = 'https://controlplane.tailscale.com';
		config.acceptDns = true;
		config.acceptRoutes = false;
		config.advertiseTags = [];
		config.ssh = false;
		config.serveHttps = true;
		config.funnel = false;

		return config;
	};

	beforeEach(async () => {
		jest.useFakeTimers();
		mockSystemctlActive(true);

		cli = {
			getVersion: jest.fn().mockResolvedValue({ version: '1.78.1', raw: {} }),
			getStatus: jest.fn().mockResolvedValue(STOPPED_STATUS),
			up: jest.fn().mockResolvedValue(undefined),
			set: jest.fn().mockResolvedValue(undefined),
			down: jest.fn().mockResolvedValue(undefined),
			logout: jest.fn().mockResolvedValue(undefined),
			serveReset: jest.fn().mockResolvedValue(undefined),
		};

		configServiceMock = { getPluginConfig: jest.fn().mockReturnValue(defaultConfig()) };
		nestConfigServiceMock = { get: jest.fn().mockReturnValue(undefined) };
		platformServiceMock = { getPlatformType: jest.fn().mockReturnValue(PlatformType.RASPBERRY) };
		eventEmitterMock = { emit: jest.fn() };

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TailscaleNodeManagedService,
				TailscaleStatusMapperService,
				{ provide: TailscaleCliService, useValue: cli },
				{ provide: ConfigService, useValue: configServiceMock },
				{ provide: NestConfigService, useValue: nestConfigServiceMock },
				{ provide: PlatformService, useValue: platformServiceMock },
				{ provide: EventEmitter2, useValue: eventEmitterMock },
			],
		}).compile();

		service = module.get<TailscaleNodeManagedService>(TailscaleNodeManagedService);
	});

	afterEach(async () => {
		await service.stop().catch(() => undefined);
		jest.clearAllTimers();
		jest.useRealTimers();
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
		expect(service.owner).toEqual({ kind: 'plugin', type: 'remote-access-tailscale-plugin' });
		expect(service.serviceId).toBe('node');
		expect(service.activationPolicy).toBe('owner-enabled');
	});

	describe('compareTailscaleVersions', () => {
		it('orders versions numerically, not lexically', () => {
			expect(compareTailscaleVersions('1.9.0', '1.10.0')).toBeLessThan(0);
			expect(compareTailscaleVersions('1.66.0', '1.66.0')).toBe(0);
			expect(compareTailscaleVersions('1.70.0', '1.66.0')).toBeGreaterThan(0);
			expect(compareTailscaleVersions('1.66', '1.66.0')).toBe(0);
		});
	});

	describe('evaluateRequirements — one missing at a time', () => {
		it('platform-supported missing short-circuits the rest without touching the CLI', async () => {
			platformServiceMock.getPlatformType.mockReturnValue(PlatformType.DOCKER);

			const requirements = await service.evaluateRequirements();

			expectRequirements(requirements, [
				{ code: 'platform-supported', satisfied: false },
				{ code: 'binary-installed', satisfied: false },
				{ code: 'daemon-active', satisfied: false },
				{ code: 'operator-granted', satisfied: false },
				{ code: 'version-supported', satisfied: false },
			]);
			expect(cli.getVersion).not.toHaveBeenCalled();
			expect(cli.getStatus).not.toHaveBeenCalled();
			expect(execFile).not.toHaveBeenCalled();
		});

		it('development platform is unsupported without the env override', async () => {
			platformServiceMock.getPlatformType.mockReturnValue(PlatformType.DEVELOPMENT);
			nestConfigServiceMock.get.mockReturnValue(undefined);

			const requirements = await service.evaluateRequirements();

			expect(requirements[0]).toMatchObject({ code: 'platform-supported', satisfied: false });
		});

		it('development platform is supported with FB_REMOTE_ACCESS_ALLOW_DEV=true', async () => {
			platformServiceMock.getPlatformType.mockReturnValue(PlatformType.DEVELOPMENT);
			nestConfigServiceMock.get.mockImplementation((key: string) =>
				key === REMOTE_ACCESS_TAILSCALE_ALLOW_DEV_ENV ? 'true' : undefined,
			);

			const requirements = await service.evaluateRequirements();

			expect(requirements[0]).toMatchObject({ code: 'platform-supported', satisfied: true });
		});

		it('binary-installed missing (and version-supported cannot be verified)', async () => {
			cli.getVersion.mockRejectedValue(new TailscaleCliError('not-installed', 'not installed'));
			cli.getStatus.mockRejectedValue(new TailscaleCliError('not-installed', 'not installed'));

			const requirements = await service.evaluateRequirements();

			expectRequirements(requirements, [
				{ code: 'platform-supported', satisfied: true },
				{ code: 'binary-installed', satisfied: false },
				{ code: 'daemon-active', satisfied: true },
				{ code: 'operator-granted', satisfied: false },
				{ code: 'version-supported', satisfied: false },
			]);
		});

		it('daemon-active missing (and operator-granted cannot be verified)', async () => {
			mockSystemctlActive(false);
			cli.getStatus.mockRejectedValue(new TailscaleCliError('daemon-down', 'daemon down'));

			const requirements = await service.evaluateRequirements();

			expectRequirements(requirements, [
				{ code: 'platform-supported', satisfied: true },
				{ code: 'binary-installed', satisfied: true },
				{ code: 'daemon-active', satisfied: false },
				{ code: 'operator-granted', satisfied: false },
				{ code: 'version-supported', satisfied: true },
			]);
		});

		it('operator-granted missing', async () => {
			cli.getStatus.mockRejectedValue(new TailscaleCliError('permission-denied', 'denied'));

			const requirements = await service.evaluateRequirements();

			expectRequirements(requirements, [
				{ code: 'platform-supported', satisfied: true },
				{ code: 'binary-installed', satisfied: true },
				{ code: 'daemon-active', satisfied: true },
				{ code: 'operator-granted', satisfied: false },
				{ code: 'version-supported', satisfied: true },
			]);
		});

		it('version-supported missing (binary is installed but too old)', async () => {
			cli.getVersion.mockResolvedValue({ version: '1.40.0', raw: {} });

			const requirements = await service.evaluateRequirements();

			expectRequirements(requirements, [
				{ code: 'platform-supported', satisfied: true },
				{ code: 'binary-installed', satisfied: true },
				{ code: 'daemon-active', satisfied: true },
				{ code: 'operator-granted', satisfied: true },
				{ code: 'version-supported', satisfied: false },
			]);
		});

		it('all satisfied', async () => {
			const requirements = await service.evaluateRequirements();

			expect(requirements.every((r) => r.satisfied)).toBe(true);
		});
	});

	describe('start', () => {
		it('applies preferences and brings the node up when it already holds a key and all requirements are satisfied', async () => {
			cli.getStatus.mockResolvedValue(STOPPED_STATUS);

			await service.start();

			expect(cli.set).toHaveBeenCalledWith([
				'--hostname=smart-panel',
				'--accept-dns=true',
				'--accept-routes=false',
				'--advertise-tags=',
				'--ssh=false',
				`--operator=${os.userInfo().username}`,
			]);
			expect(cli.up).toHaveBeenCalledWith([
				'--hostname=smart-panel',
				'--accept-dns=true',
				'--accept-routes=false',
				'--advertise-tags=',
				'--ssh=false',
				`--operator=${os.userInfo().username}`,
				'--login-server=https://controlplane.tailscale.com',
			]);
			expect(cli.up).not.toHaveBeenCalledWith(expect.arrayContaining([expect.stringMatching(/^--auth-key=/)]));
		});

		it('never calls up when the node has never held a key (no interactive login in this plugin core)', async () => {
			cli.getStatus.mockResolvedValue({ BackendState: 'NeedsLogin' });

			await service.start();

			expect(cli.set).not.toHaveBeenCalled();
			expect(cli.up).not.toHaveBeenCalled();
		});

		it('does not call set/up when a requirement is missing, but still reaches started', async () => {
			platformServiceMock.getPlatformType.mockReturnValue(PlatformType.DOCKER);

			await service.start();

			expect(cli.set).not.toHaveBeenCalled();
			expect(cli.up).not.toHaveBeenCalled();
			expect(service.getState()).toBe('started');
		});

		it('is idempotent', async () => {
			cli.getStatus.mockResolvedValue(STOPPED_STATUS);

			await service.start();
			cli.set.mockClear();
			cli.up.mockClear();
			await service.start();

			expect(cli.set).not.toHaveBeenCalled();
			expect(cli.up).not.toHaveBeenCalled();
		});

		it('reaches started even when the CLI throws unexpectedly while applying preferences', async () => {
			cli.getStatus.mockResolvedValue(STOPPED_STATUS);
			cli.set.mockRejectedValue(new Error('boom'));

			await expect(service.start()).resolves.toBeUndefined();
			expect(service.getState()).toBe('started');
		});
	});

	describe('stop', () => {
		it('runs down, never logout, and reaches stopped', async () => {
			await service.start();
			await service.stop();

			expect(cli.down).toHaveBeenCalledTimes(1);
			expect(cli.logout).not.toHaveBeenCalled();
			expect(service.getState()).toBe('stopped');
		});

		it('reaches stopped even when down fails', async () => {
			cli.down.mockRejectedValue(new TailscaleCliError('daemon-down', 'already down'));

			await service.start();
			await service.stop();

			expect(service.getState()).toBe('stopped');
		});

		it('is idempotent', async () => {
			await service.start();
			await service.stop();
			cli.down.mockClear();
			await service.stop();

			expect(cli.down).not.toHaveBeenCalled();
		});

		it('stops the poller — no further status computation happens after stop', async () => {
			cli.getStatus.mockResolvedValue(STOPPED_STATUS);

			await service.start();
			await jest.runOnlyPendingTimersAsync();
			await service.stop();

			const callsAtStop = cli.getStatus.mock.calls.length;

			await jest.advanceTimersByTimeAsync(60_000);

			expect(cli.getStatus.mock.calls.length).toBe(callsAtStop);
		});
	});

	describe('onConfigChanged', () => {
		it('reports restartRequired only when login_server changed', async () => {
			cli.getStatus.mockResolvedValue(STOPPED_STATUS);
			await service.start();

			const changed = defaultConfig();
			changed.loginServer = 'https://headscale.example.com';
			configServiceMock.getPluginConfig.mockReturnValue(changed);

			await expect(service.onConfigChanged()).resolves.toEqual({ restartRequired: true });
		});

		it('applies other preference changes with set and reports no restart required', async () => {
			cli.getStatus.mockResolvedValue(STOPPED_STATUS);
			await service.start();
			cli.set.mockClear();

			const changed = defaultConfig();
			changed.hostname = 'new-hostname';
			configServiceMock.getPluginConfig.mockReturnValue(changed);

			await expect(service.onConfigChanged()).resolves.toEqual({ restartRequired: false });
			expect(cli.set).toHaveBeenCalledWith(expect.arrayContaining(['--hostname=new-hostname']));
		});

		it('does not apply preferences when the node has never held a key', async () => {
			cli.getStatus.mockResolvedValue({ BackendState: 'NeedsLogin' });
			await service.start();
			cli.set.mockClear();

			await expect(service.onConfigChanged()).resolves.toEqual({ restartRequired: false });
			expect(cli.set).not.toHaveBeenCalled();
		});
	});

	describe('isHealthy', () => {
		it('is true only when Running and Self.Online', async () => {
			cli.getStatus.mockResolvedValue({ BackendState: 'Running', Self: { Online: true } });

			await expect(service.isHealthy()).resolves.toBe(true);
		});

		it('is false when Running but not Online', async () => {
			cli.getStatus.mockResolvedValue({ BackendState: 'Running', Self: { Online: false } });

			await expect(service.isHealthy()).resolves.toBe(false);
		});

		it('is false when Stopped', async () => {
			cli.getStatus.mockResolvedValue(STOPPED_STATUS);

			await expect(service.isHealthy()).resolves.toBe(false);
		});

		it('is false when the CLI throws', async () => {
			cli.getStatus.mockRejectedValue(new TailscaleCliError('daemon-down', 'boom'));

			await expect(service.isHealthy()).resolves.toBe(false);
		});
	});

	describe('poller interval switching', () => {
		it('polls again after 5s while connecting, not before', async () => {
			cli.getStatus.mockResolvedValue({ BackendState: 'Starting' });

			await service.start();
			// start() schedules the first poll immediately (delay 0); flush that
			// one tick before measuring the *next* interval.
			await jest.runOnlyPendingTimersAsync();
			const callsAfterFirstPoll = cli.getStatus.mock.calls.length;

			await jest.advanceTimersByTimeAsync(4_999);
			expect(cli.getStatus.mock.calls.length).toBe(callsAfterFirstPoll);

			await jest.advanceTimersByTimeAsync(1);
			expect(cli.getStatus.mock.calls.length).toBe(callsAfterFirstPoll + 1);
		});

		it('polls again only after 30s once stable (connected)', async () => {
			cli.getStatus.mockResolvedValue(RUNNING_CONNECTED_STATUS);

			await service.start();
			await jest.runOnlyPendingTimersAsync();
			const callsAfterFirstPoll = cli.getStatus.mock.calls.length;

			await jest.advanceTimersByTimeAsync(29_999);
			expect(cli.getStatus.mock.calls.length).toBe(callsAfterFirstPoll);

			await jest.advanceTimersByTimeAsync(1);
			expect(cli.getStatus.mock.calls.length).toBe(callsAfterFirstPoll + 1);
		});
	});

	describe('event emission', () => {
		it('emits PROVIDER_STATUS on the first poll', async () => {
			cli.getStatus.mockResolvedValue(RUNNING_CONNECTED_STATUS);

			await service.start();
			await jest.runOnlyPendingTimersAsync();

			expect(eventEmitterMock.emit).toHaveBeenCalledWith(
				RemoteAccessEventType.PROVIDER_STATUS,
				expect.objectContaining({ type: 'remote-access-tailscale', state: 'connected' }),
			);
		});

		it('does not emit again when the next poll reports an unchanged status', async () => {
			cli.getStatus.mockResolvedValue(RUNNING_CONNECTED_STATUS);

			await service.start();
			await jest.runOnlyPendingTimersAsync();
			eventEmitterMock.emit.mockClear();

			await jest.advanceTimersByTimeAsync(TAILSCALE_STABLE_INTERVAL);

			expect(eventEmitterMock.emit).not.toHaveBeenCalled();
		});

		it('emits again once the mapped status changes', async () => {
			cli.getStatus.mockResolvedValue(RUNNING_CONNECTED_STATUS);
			await service.start();
			await jest.runOnlyPendingTimersAsync();
			eventEmitterMock.emit.mockClear();

			cli.getStatus.mockResolvedValue(STOPPED_STATUS);
			await jest.advanceTimersByTimeAsync(TAILSCALE_STABLE_INTERVAL);

			expect(eventEmitterMock.emit).toHaveBeenCalledWith(
				RemoteAccessEventType.PROVIDER_STATUS,
				expect.objectContaining({ state: 'disconnected' }),
			);
		});

		it('never emits an authUrl, qr or key in the payload, even while pending-auth', async () => {
			cli.getStatus.mockResolvedValue({
				BackendState: 'NeedsLogin',
				AuthURL: 'https://login.tailscale.com/a/super-secret-claim-link',
			});

			await service.start();
			await jest.runOnlyPendingTimersAsync();

			const [, payload] = eventEmitterMock.emit.mock.calls[0] as [string, RemoteAccessProviderStatus];

			expect(payload).not.toHaveProperty('authUrl');
			expect(payload).not.toHaveProperty('qr');
			expect(payload).not.toHaveProperty('AuthURL');
			expect(JSON.stringify(payload)).not.toContain('super-secret-claim-link');
			expect(Object.keys(payload).sort()).toEqual(
				['advisories', 'details', 'endpoints', 'message', 'proxyAddresses', 'state', 'type', 'updatedAt'].sort(),
			);
		});
	});

	describe('factoryReset', () => {
		it('runs serve reset then logout, in order, and reports success', async () => {
			await expect(service.factoryReset()).resolves.toEqual({ success: true });

			const serveResetOrder = cli.serveReset.mock.invocationCallOrder[0];
			const logoutOrder = cli.logout.mock.invocationCallOrder[0];

			expect(serveResetOrder).toBeLessThan(logoutOrder);
		});

		it('tolerates a serve reset failure and still logs out', async () => {
			cli.serveReset.mockRejectedValue(new Error('nothing was ever served'));

			await expect(service.factoryReset()).resolves.toEqual({ success: true });
			expect(cli.logout).toHaveBeenCalledTimes(1);
		});

		it('treats "nothing to log out of" as success', async () => {
			cli.logout.mockRejectedValue(new TailscaleCliError('not-installed', 'not installed'));

			await expect(service.factoryReset()).resolves.toEqual({ success: true });
		});

		it('reports failure for an unexpected logout error', async () => {
			cli.logout.mockRejectedValue(new TailscaleCliError('unknown', 'something broke'));

			const result = await service.factoryReset();

			expect(result.success).toBe(false);
			expect(result.reason).toContain('something broke');
		});
	});
});
