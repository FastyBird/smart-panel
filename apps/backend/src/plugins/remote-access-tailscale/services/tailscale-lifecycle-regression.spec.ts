import { execFile } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os, { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';

import { ConfigService } from '../../../modules/config/services/config.service';
import { PlatformType } from '../../../modules/platform/platform.constants';
import { PlatformService } from '../../../modules/platform/services/platform.service';
import { RemoteAccessProviderStatus } from '../../../modules/remote-access/platforms/remote-access-provider.platform';
import { EventType } from '../../../modules/remote-access/remote-access.constants';
import { RemoteAccessTailscalePluginConfigModel } from '../models/config.model';

import { TailscaleCliService, TailscaleStatus } from './tailscale-cli.service';
import { TailscaleLoginService } from './tailscale-login.service';
import { TailscaleNodeManagedService } from './tailscale-node-managed.service';
import { TailscaleServeResult, TailscaleServeService } from './tailscale-serve.service';
import { TailscaleStatusMapperService } from './tailscale-status-mapper.service';

jest.mock('node:child_process', () => ({
	...jest.requireActual<typeof import('node:child_process')>('node:child_process'),
	execFile: jest.fn(),
}));

const EMPTY_SERVE: TailscaleServeResult = {
	endpoints: [],
	proxyAddresses: [],
	advisories: [],
	permissionDenied: false,
};

const CONNECTED: TailscaleStatus = {
	BackendState: 'Running',
	Self: { Online: true, TailscaleIPs: ['100.64.0.5'], DNSName: 'panel.tailc0ffee.ts.net.' },
	CurrentTailnet: { Name: 'example.ts.net', MagicDNSEnabled: false },
	Version: '1.78.1',
};

function deferred<T>(): {
	promise: Promise<T>;
	resolve: (value: T) => void;
	entered: () => void;
	reached: Promise<void>;
} {
	let resolve!: (value: T) => void;
	let entered!: () => void;
	return {
		promise: new Promise<T>((done) => (resolve = done)),
		resolve,
		entered: () => entered(),
		reached: new Promise<void>((done) => (entered = done)),
	};
}

class LoginChild extends EventEmitter {
	stdout = Object.assign(new EventEmitter(), { resume: jest.fn() });
	stderr = Object.assign(new EventEmitter(), { resume: jest.fn() });
	kill = jest.fn(() => {
		this.emit('close', null);
		return true;
	});
}

describe('Tailscale lifecycle regressions', () => {
	let node: TailscaleNodeManagedService;
	let cli: {
		getVersion: jest.Mock;
		getStatus: jest.Mock;
		getPrefs: jest.Mock;
		up: jest.Mock;
		set: jest.Mock;
		down: jest.Mock;
		logout: jest.Mock;
		serveReset: jest.Mock;
		spawnUp: jest.Mock;
	};
	let emitter: { emit: jest.Mock };
	let serve: { read: jest.Mock; converge: jest.Mock };

	beforeEach(async () => {
		jest.useFakeTimers();
		(execFile as unknown as jest.Mock).mockImplementation(
			(_file: string, _args: string[], _options: unknown, callback: (error: Error | null, stdout?: string) => void) => {
				callback(null, 'active\n');
				return {};
			},
		);

		cli = {
			getVersion: jest.fn().mockResolvedValue({ version: '1.78.1', raw: {} }),
			getStatus: jest.fn().mockResolvedValue(CONNECTED),
			getPrefs: jest.fn().mockResolvedValue({ OperatorUser: os.userInfo().username }),
			up: jest.fn().mockResolvedValue(undefined),
			set: jest.fn().mockResolvedValue(undefined),
			down: jest.fn().mockResolvedValue(undefined),
			logout: jest.fn().mockResolvedValue(undefined),
			serveReset: jest.fn().mockResolvedValue(undefined),
			spawnUp: jest.fn(),
		};
		emitter = { emit: jest.fn() };
		serve = {
			read: jest.fn().mockResolvedValue(EMPTY_SERVE),
			converge: jest.fn().mockResolvedValue(EMPTY_SERVE),
		};
		const config = new RemoteAccessTailscalePluginConfigModel();
		config.enabled = true;
		config.hostname = 'smart-panel';
		config.loginServer = 'https://controlplane.tailscale.com';
		config.acceptDns = true;
		config.acceptRoutes = false;
		config.advertiseTags = [];
		config.ssh = false;
		config.serveHttps = true;
		config.funnel = false;

		const module = await Test.createTestingModule({
			providers: [
				TailscaleNodeManagedService,
				TailscaleStatusMapperService,
				{ provide: TailscaleCliService, useValue: cli },
				{ provide: ConfigService, useValue: { getPluginConfig: jest.fn().mockReturnValue(config) } },
				{ provide: NestConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
				{
					provide: PlatformService,
					useValue: { getPlatformTypeAsync: jest.fn().mockResolvedValue(PlatformType.RASPBERRY) },
				},
				{ provide: EventEmitter2, useValue: emitter },
				{ provide: TailscaleServeService, useValue: serve },
			],
		}).compile();
		node = module.get(TailscaleNodeManagedService);
	});

	afterEach(async () => {
		await node.stop().catch(() => undefined);
		jest.clearAllTimers();
		jest.useRealTimers();
		jest.clearAllMocks();
	});

	it('keeps the authenticated tailnet available after Disconnect', async () => {
		await node.start();
		await node.computeStatus();
		await node.stop();

		const status = await node.computeStatus();

		expect(status.state).toBe('disconnected');
		expect(status.endpoints).toEqual([]);
		expect(
			(node as unknown as { getControlState(): { authentication: string } }).getControlState().authentication,
		).toBe('authenticated');
	});

	it('does not let a delayed status read return Connected after stop', async () => {
		await node.start();
		const gate = deferred<TailscaleServeResult>();
		serve.read.mockImplementationOnce(() => {
			gate.entered();
			return gate.promise;
		});

		const pendingStatus = node.computeStatus();
		await gate.reached;
		await node.stop();
		gate.resolve(EMPTY_SERVE);

		expect((await pendingStatus).state).toBe('disconnected');
	});

	it('supersedes a delayed read from the prior generation after stop and restart', async () => {
		await node.start();
		const gate = deferred<TailscaleServeResult>();
		serve.read.mockImplementationOnce(() => {
			gate.entered();
			return gate.promise;
		});

		const oldStatus = node.computeStatus();
		await gate.reached;
		await node.stop();
		cli.getStatus.mockResolvedValue({ BackendState: 'NeedsLogin' });
		await node.start();
		gate.resolve(EMPTY_SERVE);

		const status = await oldStatus;
		expect(status.state).toBe('disconnected');
		expect(status.details.tailnet).not.toBe('example.ts.net');
		expect(node.getControlState().authentication).toBe('required');
	});

	it('does not publish Connected when Serve convergence completes after stop', async () => {
		await node.start();
		const gate = deferred<TailscaleServeResult>();
		serve.converge.mockImplementationOnce(() => {
			gate.entered();
			return gate.promise;
		});

		const tick = (node as unknown as { pollTick(): Promise<void> }).pollTick();
		await gate.reached;
		await node.stop();
		gate.resolve(EMPTY_SERVE);
		await tick;

		const published = emitter.emit.mock.calls
			.filter(([event]) => event === EventType.PROVIDER_OBSERVATION)
			.map(([, status]) => (status as { status: RemoteAccessProviderStatus }).status.state);
		expect(published.at(-1)).toBe('disconnected');
	});

	it('does not publish an older read after newer REST observations complete during convergence', async () => {
		await node.start();
		const gate = deferred<TailscaleServeResult>();
		serve.converge.mockImplementationOnce(() => {
			gate.entered();
			return gate.promise;
		});
		const tick = (node as unknown as { pollTick(): Promise<void> }).pollTick();
		await gate.reached;
		cli.getStatus.mockResolvedValue({ BackendState: 'NeedsLogin' });
		expect((await node.getStatusSnapshot({ fresh: true })).status.state).toBe('setup-required');
		const count = emitter.emit.mock.calls.length;
		gate.resolve(EMPTY_SERVE);
		await tick;
		expect(emitter.emit).toHaveBeenCalledTimes(count);
	});

	it('keeps a healthy overlapping status read Connected across routine Serve convergence', async () => {
		await node.start();
		const convergence = deferred<TailscaleServeResult>();
		serve.converge.mockImplementationOnce(() => {
			convergence.entered();
			return convergence.promise;
		});
		const tick = (node as unknown as { pollTick(): Promise<void> }).pollTick();
		await convergence.reached;

		const statusRead = deferred<TailscaleServeResult>();
		serve.read.mockImplementationOnce(() => {
			statusRead.entered();
			return statusRead.promise;
		});
		const pendingStatus = node.computeStatus();
		await statusRead.reached;
		convergence.resolve(EMPTY_SERVE);
		await tick;
		statusRead.resolve(EMPTY_SERVE);

		const status = await pendingStatus;
		expect(status.state).toBe('connected');
		expect(status.details.tailnet).toBe('example.ts.net');
		expect(status.endpoints).toEqual([
			{ url: 'http://100.64.0.5:3000', scope: 'private', https: false, label: 'Tailscale IPv4' },
		]);
	});

	it('cancels and reaps an interactive login child when the node stops', async () => {
		node.getPluginConfig().advertiseTags = ['tag:smart-panel', 'tag:home'];
		await node.start();
		const child = new LoginChild();
		let closed = false;
		child.once('close', () => (closed = true));
		cli.spawnUp.mockReturnValue(child);
		const nestConfig = { get: jest.fn().mockReturnValue(undefined) };
		const login = new TailscaleLoginService(
			cli as unknown as TailscaleCliService,
			node,
			nestConfig as unknown as NestConfigService,
		);

		let onSpawn!: () => void;
		const spawned = new Promise<void>((resolve) => (onSpawn = resolve));
		cli.spawnUp.mockImplementation(() => {
			onSpawn();
			return child;
		});
		const loginStarted = login.login();
		await spawned;
		expect(cli.spawnUp).toHaveBeenCalledWith(
			expect.arrayContaining([
				'--advertise-tags=tag:smart-panel,tag:home',
				'--login-server=https://controlplane.tailscale.com',
			]),
		);
		child.stdout.emit('data', Buffer.from(JSON.stringify({ AuthURL: 'https://login.example.invalid/a/test' })));
		await expect(loginStarted).resolves.toMatchObject({ state: 'pending-auth' });
		await node.stop();

		expect(child.kill).toHaveBeenCalled();
		expect(login.getPendingInteractiveAuth()).toBeNull();
		expect(closed).toBe(true);

		const nextChild = new LoginChild();
		let onRetrySpawn!: () => void;
		const retrySpawned = new Promise<void>((resolve) => (onRetrySpawn = resolve));
		cli.spawnUp.mockImplementationOnce(() => {
			onRetrySpawn();
			return nextChild;
		});
		const retriedLogin = login.login();
		await retrySpawned;
		nextChild.stdout.emit('data', Buffer.from(JSON.stringify({ AuthURL: 'https://login.example.invalid/a/new' })));
		await expect(retriedLogin).resolves.toMatchObject({ authUrl: 'https://login.example.invalid/a/new' });
		expect(cli.spawnUp).toHaveBeenCalledTimes(2);
		await node.stop();
	});

	it('rejects Connect without a key and does not run ordinary tailscale up', async () => {
		cli.getStatus.mockResolvedValue({ BackendState: 'NeedsLogin' });

		await expect(node.connect()).rejects.toMatchObject({ kind: 'needs-login' });

		expect(cli.up).not.toHaveBeenCalled();
	});

	it('retains authenticated state when logout fails', async () => {
		await node.start();
		await node.computeStatus();
		cli.logout.mockRejectedValue(new Error('logout failed'));
		const login = new TailscaleLoginService(cli as unknown as TailscaleCliService, node, {
			get: jest.fn().mockReturnValue(undefined),
		} as unknown as NestConfigService);

		await expect(login.logout()).rejects.toThrow('logout failed');

		expect(node.getControlState().authentication).toBe('authenticated');
	});

	it('invalidates late setup reconciliation on a no-op Disconnect without running down', async () => {
		const oldGeneration = node.getOperationCoordinator().getGeneration();

		await node.stop();
		await node.reconcileSetup(oldGeneration);

		expect(cli.down).not.toHaveBeenCalled();
		expect(cli.up).not.toHaveBeenCalled();
	});

	it('cancels and reaps an auth-key login on Disconnect and removes its temporary key file', async () => {
		const dataDir = mkdtempSync(join(tmpdir(), 'tailscale-stop-login-'));
		const child = new LoginChild();
		let closed = false;
		child.once('close', () => (closed = true));
		let authKeyPath: string | undefined;

		try {
			await node.start();
			jest.useRealTimers();
			const nestConfig = {
				get: jest.fn().mockImplementation((key: string) => (key === 'FB_DATA_DIR' ? dataDir : undefined)),
			};
			const login = new TailscaleLoginService(
				cli as unknown as TailscaleCliService,
				node,
				nestConfig as unknown as NestConfigService,
			);
			let onSpawn!: () => void;
			const spawned = new Promise<void>((resolve) => (onSpawn = resolve));
			cli.spawnUp.mockImplementation(() => {
				onSpawn();
				return child;
			});

			const loginAttempt = login.login('tskey-auth-ABCDE1234-secret-value');
			await spawned;
			const spawnCalls = cli.spawnUp.mock.calls as unknown as [string[]][];
			expect(spawnCalls[0][0]).toContain('--advertise-tags=');
			const authKeyArgument = spawnCalls[0][0].find((arg) => arg.startsWith('--auth-key=file:'));
			expect(authKeyArgument).toBeDefined();
			if (!authKeyArgument) {
				throw new Error('The auth-key child did not receive an ephemeral key file.');
			}
			authKeyPath = authKeyArgument.slice('--auth-key=file:'.length);
			expect(existsSync(authKeyPath)).toBe(true);

			await node.stop();
			await expect(loginAttempt).rejects.toMatchObject({ code: 'operation-cancelled' });
			expect(child.kill).toHaveBeenCalled();
			expect(closed).toBe(true);

			const deadline = Date.now() + 2_000;
			while (existsSync(authKeyPath) && Date.now() < deadline) {
				await new Promise((resolve) => setTimeout(resolve, 5));
			}
			expect(existsSync(authKeyPath)).toBe(false);
		} finally {
			await node.stop().catch(() => undefined);
			if (authKeyPath && existsSync(authKeyPath)) {
				const deadline = Date.now() + 2_000;
				while (existsSync(authKeyPath) && Date.now() < deadline) {
					await new Promise((resolve) => setTimeout(resolve, 5));
				}
			}
			rmSync(dataDir, { recursive: true, force: true });
		}
	});
});
