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
import { TailscaleServeApplyResult, TailscaleServeService } from './tailscale-serve.service';
import { TailscaleStatusMapperService } from './tailscale-status-mapper.service';

const EMPTY_SERVE_RESULT: TailscaleServeApplyResult = { endpoints: [], proxyAddresses: [], advisories: [] };

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
	let platformServiceMock: { getPlatformTypeAsync: jest.Mock };
	let eventEmitterMock: { emit: jest.Mock };
	let serveServiceMock: { apply: jest.Mock };

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
		platformServiceMock = { getPlatformTypeAsync: jest.fn().mockResolvedValue(PlatformType.RASPBERRY) };
		eventEmitterMock = { emit: jest.fn() };
		// Serve/Funnel apply matrix and read-back parsing are covered in full
		// by tailscale-serve.service.spec.ts; this mock defaults to "nothing
		// to contribute" so every pre-existing test in this file (written
		// before RA-6) keeps observing empty proxyAddresses/advisories and no
		// extra endpoint unless a test below overrides it.
		serveServiceMock = { apply: jest.fn().mockResolvedValue(EMPTY_SERVE_RESULT) };

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TailscaleNodeManagedService,
				TailscaleStatusMapperService,
				{ provide: TailscaleCliService, useValue: cli },
				{ provide: ConfigService, useValue: configServiceMock },
				{ provide: NestConfigService, useValue: nestConfigServiceMock },
				{ provide: PlatformService, useValue: platformServiceMock },
				{ provide: EventEmitter2, useValue: eventEmitterMock },
				{ provide: TailscaleServeService, useValue: serveServiceMock },
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
			platformServiceMock.getPlatformTypeAsync.mockResolvedValue(PlatformType.DOCKER);

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

		it('awaits platform detection instead of reading it while still undefined, and never prints "undefined" in the message', async () => {
			// getPlatformTypeAsync() only resolves once PlatformService's own
			// detection promise settles — right after boot it can still be
			// in flight. Resolving it after evaluateRequirements() has already
			// started proves the platform type is awaited, not read
			// synchronously (which would have observed `undefined` and produced
			// a message naming the "'undefined'" platform).
			let resolvePlatformType!: (value: PlatformType) => void;

			platformServiceMock.getPlatformTypeAsync.mockReturnValue(
				new Promise((resolve) => {
					resolvePlatformType = resolve;
				}),
			);

			const requirementsPromise = service.evaluateRequirements();

			resolvePlatformType(PlatformType.RASPBERRY);

			const requirements = await requirementsPromise;

			expect(requirements[0]).toMatchObject({ code: 'platform-supported', satisfied: true });
			expect(requirements[0].message).not.toContain('undefined');
		});

		it('development platform is unsupported without the env override', async () => {
			platformServiceMock.getPlatformTypeAsync.mockResolvedValue(PlatformType.DEVELOPMENT);
			nestConfigServiceMock.get.mockReturnValue(undefined);

			const requirements = await service.evaluateRequirements();

			expect(requirements[0]).toMatchObject({ code: 'platform-supported', satisfied: false });
		});

		it('development platform is supported with FB_REMOTE_ACCESS_ALLOW_DEV=true', async () => {
			platformServiceMock.getPlatformTypeAsync.mockResolvedValue(PlatformType.DEVELOPMENT);
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
			platformServiceMock.getPlatformTypeAsync.mockResolvedValue(PlatformType.DOCKER);

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

		it('does not revive the poller or emit if a poll tick is still in flight when stop() finishes', async () => {
			// pollTick() runs outside withLock (it is a bare setTimeout
			// callback), so stop() can complete while a tick's own
			// computeStatus() call is still pending. That tick must not
			// reschedule itself or emit once it finally resolves.
			let resolvePendingStatus: ((status: TailscaleStatus) => void) | null = null;
			let callCount = 0;

			cli.getStatus.mockImplementation(() => {
				callCount += 1;

				// The first two calls are start()'s own synchronous checks
				// (the operator-granted probe, then the "does it hold a key"
				// check) — resolve those immediately so start() completes and
				// schedules the poller.
				if (callCount <= 2) {
					return Promise.resolve(STOPPED_STATUS);
				}

				// The third call is the poller's own first tick — hold it open.
				return new Promise<TailscaleStatus>((resolve) => {
					resolvePendingStatus = resolve;
				});
			});

			await service.start();

			// Fire the poller's initial (delay 0) timer so it enters
			// pollTick() and calls computeStatus(), now hung on the promise above.
			await jest.advanceTimersByTimeAsync(0);
			expect(resolvePendingStatus).not.toBeNull();

			// stop() runs to completion while that tick is still in flight.
			await service.stop();
			expect(service.getState()).toBe('stopped');

			// Resolve the in-flight tick with a status that differs from the
			// (still-null) lastStatus — this would normally emit and reschedule.
			resolvePendingStatus(RUNNING_CONNECTED_STATUS);
			await jest.advanceTimersByTimeAsync(0);

			expect(eventEmitterMock.emit).not.toHaveBeenCalled();
			expect(jest.getTimerCount()).toBe(0);
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

		it('signs the node out when login_server changes, so it comes back requiring a fresh login (RA-5)', async () => {
			cli.getStatus.mockResolvedValue(STOPPED_STATUS);
			await service.start();
			cli.logout.mockClear();

			const changed = defaultConfig();
			changed.loginServer = 'https://headscale.example.com';
			configServiceMock.getPluginConfig.mockReturnValue(changed);

			await service.onConfigChanged();

			expect(cli.logout).toHaveBeenCalledTimes(1);
		});

		it('does not fail the config change when logout has nothing to sign out of', async () => {
			cli.getStatus.mockResolvedValue(STOPPED_STATUS);
			await service.start();
			cli.logout.mockRejectedValueOnce(new TailscaleCliError('needs-login', 'not logged in'));

			const changed = defaultConfig();
			changed.loginServer = 'https://headscale.example.com';
			configServiceMock.getPluginConfig.mockReturnValue(changed);

			await expect(service.onConfigChanged()).resolves.toEqual({ restartRequired: true });
		});

		it('also tolerates daemon-down and not-installed — still nothing to sign out of', async () => {
			cli.getStatus.mockResolvedValue(STOPPED_STATUS);
			await service.start();

			const changed = defaultConfig();
			changed.loginServer = 'https://headscale.example.com';
			configServiceMock.getPluginConfig.mockReturnValue(changed);

			cli.logout.mockRejectedValueOnce(new TailscaleCliError('daemon-down', 'connection refused'));
			await expect(service.onConfigChanged()).resolves.toEqual({ restartRequired: true });

			// Second login_server change in a row exercises 'not-installed' too.
			const changedAgain = defaultConfig();
			changedAgain.loginServer = 'https://another-headscale.example.com';
			configServiceMock.getPluginConfig.mockReturnValue(changedAgain);

			cli.logout.mockRejectedValueOnce(new TailscaleCliError('not-installed', 'tailscale: command not found'));
			await expect(service.onConfigChanged()).resolves.toEqual({ restartRequired: true });
		});

		it('propagates a genuine logout failure instead of silently reporting a completed sign-out', async () => {
			// The bug this closes: a permission-denied, timeout or unknown
			// failure means the node may still hold a key issued by the old
			// control plane, so onConfigChanged() must not swallow it and
			// report restartRequired: true as if the sign-out actually happened.
			cli.getStatus.mockResolvedValue(STOPPED_STATUS);
			await service.start();
			cli.logout.mockRejectedValueOnce(new TailscaleCliError('permission-denied', 'access denied'));

			const changed = defaultConfig();
			changed.loginServer = 'https://headscale.example.com';
			configServiceMock.getPluginConfig.mockReturnValue(changed);

			await expect(service.onConfigChanged()).rejects.toMatchObject({ kind: 'permission-denied' });
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

		it('still detects a login_server change after start() when a requirement (daemon-active) was missing at start time', async () => {
			// The config must be cached eagerly in start() — even though
			// requirements fail here and set/up are never reached — otherwise
			// onConfigChanged() would have no "previous" value to diff against
			// once the daemon comes back and the config changes.
			mockSystemctlActive(false);
			cli.getStatus.mockRejectedValue(new TailscaleCliError('daemon-down', 'daemon down'));

			await service.start();

			expect(cli.set).not.toHaveBeenCalled();
			expect(cli.up).not.toHaveBeenCalled();

			// The daemon comes back and login_server changes.
			mockSystemctlActive(true);
			cli.getStatus.mockResolvedValue(STOPPED_STATUS);

			const changed = defaultConfig();
			changed.loginServer = 'https://headscale.example.com';
			configServiceMock.getPluginConfig.mockReturnValue(changed);

			await expect(service.onConfigChanged()).resolves.toEqual({ restartRequired: true });
		});

		it('treats an unknown previous config as restart-required, defensively', async () => {
			// onConfigChanged() called without start() ever having run — the
			// config was never cached, so there is no known "previous" value
			// to diff against. Fail safe: request a restart rather than
			// silently assume nothing changed.
			await expect(service.onConfigChanged()).resolves.toEqual({ restartRequired: true });
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
				expect.objectContaining({ type: 'remote-access-tailscale-plugin', state: 'connected' }),
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

	describe('Serve/Funnel apply (RA-6)', () => {
		it('calls TailscaleServeService.apply with the plugin config, backend port and raw status once connected', async () => {
			cli.getStatus.mockResolvedValue(RUNNING_CONNECTED_STATUS);

			await service.computeStatus();

			expect(serveServiceMock.apply).toHaveBeenCalledWith(
				expect.objectContaining({ serveHttps: true, funnel: false }),
				3000,
				expect.objectContaining({ BackendState: 'Running' }),
			);
		});

		it('reads the backend port from FB_BACKEND_PORT instead of the 3000 default when set', async () => {
			cli.getStatus.mockResolvedValue(RUNNING_CONNECTED_STATUS);
			nestConfigServiceMock.get.mockImplementation((key: string) => (key === 'FB_BACKEND_PORT' ? 8080 : undefined));

			await service.computeStatus();

			expect(serveServiceMock.apply).toHaveBeenCalledWith(expect.anything(), 8080, expect.anything());
		});

		it('merges the Serve result endpoints, proxyAddresses and advisories into the computed status', async () => {
			const serveResult: TailscaleServeApplyResult = {
				endpoints: [
					{ url: 'https://panel.tailc0ffee.ts.net', scope: 'private', https: true, label: 'Tailscale (HTTPS)' },
				],
				proxyAddresses: ['127.0.0.1', '::1'],
				advisories: [{ code: 'tailnet-https-disabled', severity: 'warning', message: 'x' }],
			};
			serveServiceMock.apply.mockResolvedValue(serveResult);
			cli.getStatus.mockResolvedValue(RUNNING_CONNECTED_STATUS);

			const status = await service.computeStatus();

			expect(status.endpoints).toEqual(expect.arrayContaining(serveResult.endpoints));
			expect(status.proxyAddresses).toEqual(['127.0.0.1', '::1']);
			expect(status.advisories).toEqual(expect.arrayContaining(serveResult.advisories));
		});

		it('does not call apply when the node is not connected', async () => {
			cli.getStatus.mockResolvedValue(STOPPED_STATUS);

			await service.computeStatus();

			expect(serveServiceMock.apply).not.toHaveBeenCalled();
		});

		it('does not call apply when the platform is unsupported', async () => {
			platformServiceMock.getPlatformTypeAsync.mockResolvedValue(PlatformType.DOCKER);

			await service.computeStatus();

			expect(serveServiceMock.apply).not.toHaveBeenCalled();
		});

		it('never calls apply more than once per computeStatus() call', async () => {
			cli.getStatus.mockResolvedValue(RUNNING_CONNECTED_STATUS);

			await service.computeStatus();

			expect(serveServiceMock.apply).toHaveBeenCalledTimes(1);
		});

		it('applies again immediately on a config change, without waiting for the next poll', async () => {
			cli.getStatus.mockResolvedValue(RUNNING_CONNECTED_STATUS);
			await service.start();
			await jest.runOnlyPendingTimersAsync();
			serveServiceMock.apply.mockClear();

			const changed = defaultConfig();
			changed.funnel = true;
			configServiceMock.getPluginConfig.mockReturnValue(changed);

			await service.onConfigChanged();

			expect(serveServiceMock.apply).toHaveBeenCalledWith(
				expect.objectContaining({ funnel: true }),
				3000,
				expect.objectContaining({ BackendState: 'Running' }),
			);
		});

		it('does not apply on config change when the node has never held a key', async () => {
			cli.getStatus.mockResolvedValue({ BackendState: 'NeedsLogin' });
			await service.start();

			await service.onConfigChanged();

			expect(serveServiceMock.apply).not.toHaveBeenCalled();
		});

		it('does not apply on config change when the node holds a key but is not connected', async () => {
			cli.getStatus.mockResolvedValue(STOPPED_STATUS);
			await service.start();

			await service.onConfigChanged();

			expect(serveServiceMock.apply).not.toHaveBeenCalled();
		});

		it('does not fail the config change when apply rejects', async () => {
			cli.getStatus.mockResolvedValue(RUNNING_CONNECTED_STATUS);
			await service.start();
			await jest.runOnlyPendingTimersAsync();

			serveServiceMock.apply.mockRejectedValueOnce(new Error('boom'));

			await expect(service.onConfigChanged()).resolves.toEqual({ restartRequired: false });
		});
	});

	describe('posture advisories (RA-6)', () => {
		it('adds version-unsupported when the installed version is older than the pinned minimum', async () => {
			cli.getStatus.mockResolvedValue({ ...RUNNING_CONNECTED_STATUS, Version: '1.40.0' });

			const status = await service.computeStatus();

			expect(status.advisories).toContainEqual(
				expect.objectContaining({ code: 'version-unsupported', severity: 'warning' }),
			);
		});

		it('does not add version-unsupported when the installed version meets the minimum', async () => {
			cli.getStatus.mockResolvedValue({ ...RUNNING_CONNECTED_STATUS, Version: '1.78.1' });

			const status = await service.computeStatus();

			expect(status.advisories).not.toContainEqual(expect.objectContaining({ code: 'version-unsupported' }));
		});

		it('adds key-expiring when Self.KeyExpiry is within 14 days', async () => {
			const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
			cli.getStatus.mockResolvedValue({
				...RUNNING_CONNECTED_STATUS,
				Self: { ...RUNNING_CONNECTED_STATUS.Self, KeyExpiry: soon },
			});

			const status = await service.computeStatus();

			expect(status.advisories).toContainEqual(expect.objectContaining({ code: 'key-expiring', severity: 'warning' }));
		});

		it('does not add key-expiring when Self.KeyExpiry is more than 14 days away', async () => {
			const later = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
			cli.getStatus.mockResolvedValue({
				...RUNNING_CONNECTED_STATUS,
				Self: { ...RUNNING_CONNECTED_STATUS.Self, KeyExpiry: later },
			});

			const status = await service.computeStatus();

			expect(status.advisories).not.toContainEqual(expect.objectContaining({ code: 'key-expiring' }));
		});

		it('does not add key-expiring when Self.KeyExpiry is absent (expiry disabled)', async () => {
			cli.getStatus.mockResolvedValue(RUNNING_CONNECTED_STATUS);

			const status = await service.computeStatus();

			expect(status.advisories).not.toContainEqual(expect.objectContaining({ code: 'key-expiring' }));
		});

		it('does not add key-expiring when Self.KeyExpiry is already in the past — an expired key surfaces through setup-required instead', async () => {
			const alreadyExpired = new Date(Date.now() - 60_000).toISOString();
			cli.getStatus.mockResolvedValue({
				...RUNNING_CONNECTED_STATUS,
				Self: { ...RUNNING_CONNECTED_STATUS.Self, KeyExpiry: alreadyExpired },
			});

			const status = await service.computeStatus();

			expect(status.advisories).not.toContainEqual(expect.objectContaining({ code: 'key-expiring' }));
		});

		it('reports posture advisories even when the node is not connected (e.g. disconnected with a cached KeyExpiry)', async () => {
			const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
			cli.getStatus.mockResolvedValue({ BackendState: 'Stopped', Self: { KeyExpiry: soon } });

			const status = await service.computeStatus();

			expect(status.state).toBe('disconnected');
			expect(status.advisories).toContainEqual(expect.objectContaining({ code: 'key-expiring' }));
		});
	});
});
