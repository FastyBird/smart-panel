import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'fs';
import { createServer } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';

import { Logger } from '@nestjs/common';

import { FAKE_CAMERA_SECRET_URL } from '../../../../test/support/fake-camera-stream.provider';
import { StubGo2rtcOptions, writeStubGo2rtcScript } from '../../../../test/support/stub-go2rtc.script';
import { GO2RTC_RESTART_BACKOFF_MS } from '../cameras.constants';
import { Go2rtcApiError, Go2rtcUnavailableException } from '../cameras.exceptions';
import { CamerasConfigModel, CamerasGo2rtcConfigModel } from '../models/config.model';

import { Go2rtcApiClient, Go2rtcEndpoint } from './go2rtc-api.client';
import { Go2rtcExitInfo, Go2rtcProcessOptions, Go2rtcProcessService } from './go2rtc-process.service';
import { Go2rtcSecretsRegistry } from './go2rtc-secrets.registry';
import { Go2rtcRelayStatus, Go2rtcService } from './go2rtc.service';

const API_PORT = 41984;

class FakeProcess {
	running = false;
	lines: string[] = [];
	options: Go2rtcProcessOptions | null = null;
	exitCallbacks: Array<(exit: Go2rtcExitInfo) => void> = [];

	start = jest.fn((options: Go2rtcProcessOptions, onExit: (exit: Go2rtcExitInfo) => void): void => {
		this.running = true;
		this.options = options;
		this.exitCallbacks.push(onExit);
	});

	stop = jest.fn((_graceMs?: number): Promise<void> => {
		this.running = false;

		return Promise.resolve();
	});

	isRunning(): boolean {
		return this.running;
	}

	getOutputLines(): readonly string[] {
		return this.lines;
	}

	/** The supervisor reports the exit of the most recent child. */
	exit(info: Partial<Go2rtcExitInfo> = {}): void {
		this.running = false;
		this.exitCallbacks[this.exitCallbacks.length - 1]({ code: 1, signal: null, spawnErrorCode: null, ...info });
	}
}

type MockClient = { getInfo: jest.Mock; getConfigText: jest.Mock };

describe('Go2rtcService', () => {
	let workDir: string;
	let configDir: string;
	let binaryPath: string;
	let config: CamerasConfigModel;
	let nestConfig: { get: jest.Mock };
	let secrets: Go2rtcSecretsRegistry;
	let fakeProcess: FakeProcess;
	let service: Go2rtcService;
	let client: MockClient;
	let probeClient: MockClient;
	let createClientSpy: jest.SpyInstance<Go2rtcApiClient, [Go2rtcEndpoint]>;
	let logSpies: jest.SpyInstance[];

	const goDir = (): string => join(configDir, 'go2rtc');
	/** The config file of the most recent spawn. */
	const yamlPath = (): string => fakeProcess.options?.configPath ?? '';
	const configFiles = (): string[] => (existsSync(goDir()) ? readdirSync(goDir()).sort() : []);
	const loggedCalls = (): string => JSON.stringify(logSpies.map((spy) => spy.mock.calls as unknown[][]));
	const settle = (): Promise<void> => jest.advanceTimersByTimeAsync(0);
	const crash = (): void => fakeProcess.exit({ code: 1 });
	const readInstanceSecret = (): string =>
		/^# smart-panel-instance (\S+)$/m.exec(readFileSync(yamlPath(), 'utf8'))?.[1] ?? '';
	const readPassword = (): string => /^\s+password: (\S+)$/m.exec(readFileSync(yamlPath(), 'utf8'))?.[1] ?? '';

	function createService(): Go2rtcService {
		const instance = new Go2rtcService(
			{ getModuleConfig: jest.fn(() => config) } as never,
			nestConfig as never,
			fakeProcess as unknown as Go2rtcProcessService,
			secrets,
		);

		createClientSpy = jest.spyOn(instance, 'createClient').mockImplementation((endpoint: Go2rtcEndpoint) => {
			// An unauthenticated client against the api port is the foreign-service probe.
			const isProbe = endpoint.authorization === null && endpoint.baseUrl === `http://127.0.0.1:${API_PORT}`;

			return (isProbe ? probeClient : client) as unknown as Go2rtcApiClient;
		});

		return instance;
	}

	async function startRunning(): Promise<void> {
		await service.start();
		await settle();

		expect(service.getStatus()).toMatchObject({ mode: 'managed', state: 'running', reason: null });
	}

	beforeEach(() => {
		jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });

		logSpies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map((method) =>
			jest.spyOn(Logger.prototype, method).mockImplementation(() => undefined),
		);

		workDir = mkdtempSync(join(tmpdir(), 'go2rtc-service-'));
		configDir = join(workDir, 'config');
		binaryPath = join(workDir, 'go2rtc');
		writeFileSync(binaryPath, '#!/bin/sh\n');
		chmodSync(binaryPath, 0o755);

		config = Object.assign(new CamerasConfigModel(), {
			go2rtc: Object.assign(new CamerasGo2rtcConfigModel(), { mode: 'managed', binaryPath }),
		});
		nestConfig = {
			get: jest.fn((key: string) => {
				const values: Record<string, unknown> = {
					FB_GO2RTC_API_PORT: API_PORT,
					FB_GO2RTC_RTSP_PORT: 41985,
					FB_CONFIG_PATH: configDir,
				};

				return values[key];
			}),
		};
		secrets = new Go2rtcSecretsRegistry();
		fakeProcess = new FakeProcess();
		client = {
			getInfo: jest.fn().mockImplementation(() => Promise.resolve({ version: '1.9.9-stub', configPath: yamlPath() })),
			// Serves back the file this spawn wrote, like go2rtc's `GET /api/config`.
			getConfigText: jest.fn().mockImplementation(() => Promise.resolve(readFileSync(yamlPath(), 'utf8'))),
		};
		probeClient = {
			getInfo: jest.fn().mockRejectedValue(new Go2rtcApiError(null)),
			getConfigText: jest.fn().mockRejectedValue(new Go2rtcApiError(null)),
		};
		service = createService();
	});

	afterEach(async () => {
		await service.stop().catch(() => undefined);

		jest.useRealTimers();
		jest.restoreAllMocks();
		rmSync(workDir, { recursive: true, force: true });
	});

	describe('configuration states', () => {
		it('does nothing in disabled mode', async () => {
			config.go2rtc.mode = 'disabled';

			await service.start();

			expect(service.getStatus()).toMatchObject({ mode: 'disabled', state: 'disabled', reason: 'mode_disabled' });
			expect(service.getState()).toBe('started');
			expect(fakeProcess.start).not.toHaveBeenCalled();
			expect(service.getClient()).toBeNull();
			expect(existsSync(yamlPath())).toBe(false);
		});

		it('reports binary_path_invalid for a relative path without spawning', async () => {
			config.go2rtc.binaryPath = 'go2rtc';

			await expect(service.start()).resolves.toBeUndefined();

			expect(service.getStatus()).toMatchObject({
				mode: 'managed',
				state: 'unavailable',
				reason: 'binary_path_invalid',
			});
			expect(fakeProcess.start).not.toHaveBeenCalled();
		});

		it('reports binary_missing when the binary does not exist and does not retry', async () => {
			config.go2rtc.binaryPath = join(workDir, 'go2rtc-gone');

			await expect(service.start()).resolves.toBeUndefined();
			await jest.advanceTimersByTimeAsync(120_000);

			expect(service.getStatus()).toMatchObject({ state: 'unavailable', reason: 'binary_missing' });
			expect(fakeProcess.start).not.toHaveBeenCalled();
		});

		it('reports binary_not_executable when the binary lacks the execute bit', async () => {
			chmodSync(binaryPath, 0o644);

			await expect(service.start()).resolves.toBeUndefined();

			expect(service.getStatus()).toMatchObject({ state: 'unavailable', reason: 'binary_not_executable' });
			expect(fakeProcess.start).not.toHaveBeenCalled();
		});

		it('maps an asynchronous spawn failure to unavailable without a retry', async () => {
			await service.start();
			fakeProcess.exit({ code: null, spawnErrorCode: 'ENOENT' });
			await jest.advanceTimersByTimeAsync(120_000);

			expect(service.getStatus()).toMatchObject({ state: 'unavailable', reason: 'binary_missing' });
			expect(fakeProcess.start).toHaveBeenCalledTimes(1);
		});

		it('treats a hand-edited external config without a url as unavailable', async () => {
			config.go2rtc = Object.assign(new CamerasGo2rtcConfigModel(), { mode: 'external', externalUrl: null });

			await expect(service.start()).resolves.toBeUndefined();

			expect(service.getStatus()).toMatchObject({
				mode: 'external',
				state: 'unavailable',
				reason: 'external_url_missing',
			});
			expect(createClientSpy).not.toHaveBeenCalled();
		});
	});

	describe('managed child', () => {
		it('writes a 0600 loopback config under FB_CONFIG_PATH/go2rtc', async () => {
			await service.start();

			expect(statSync(yamlPath()).mode & 0o777).toBe(0o600);
			expect(statSync(goDir()).mode & 0o777).toBe(0o700);
			expect(readFileSync(yamlPath(), 'utf8')).toContain('listen: 127.0.0.1:41984');
			expect(fakeProcess.options).toEqual({ binaryPath, configPath: yamlPath(), cwd: goDir() });
		});

		it('spawns with starting status first and talks to the api with basic auth', async () => {
			// Hold the first readiness answer back, so that the starting state is observable.
			client.getInfo.mockReturnValueOnce(new Promise(() => undefined));

			await service.start();

			expect(service.getStatus()).toMatchObject({ state: 'starting', reason: null });
			expect(service.getClient()).toBeNull();

			const [endpoint] = createClientSpy.mock.calls[0];

			expect(endpoint.baseUrl).toBe('http://127.0.0.1:41984');
			expect(endpoint.authorization).toBe(`Basic ${Buffer.from(`smart-panel:${readPassword()}`).toString('base64')}`);
		});

		it('becomes running with the version from GET /api when config_path matches', async () => {
			await startRunning();

			expect(service.getStatus().version).toBe('1.9.9-stub');
			expect(service.isRunning()).toBe(true);
			expect(service.getClient()).toBe(client);
		});

		it('registers the api password and the instance secret while the child lives and releases it afterwards', async () => {
			await startRunning();

			expect([...secrets.list()].sort()).toEqual([readPassword(), readInstanceSecret()].sort());

			await service.stop();

			expect(secrets.list()).toEqual([]);
		});

		it('uses a fresh password and regenerates the config on every spawn', async () => {
			await startRunning();

			const first = readPassword();

			crash();
			await jest.advanceTimersByTimeAsync(GO2RTC_RESTART_BACKOFF_MS[0]);
			await settle();

			expect(fakeProcess.start).toHaveBeenCalledTimes(2);
			expect(readPassword()).not.toBe(first);
		});

		it('refuses a foreign service on the api port', async () => {
			client.getInfo.mockResolvedValue({ version: '1.9.9', configPath: '/etc/frigate/go2rtc.yaml' });

			await service.start();
			await settle();

			expect(service.getStatus()).toMatchObject({ state: 'error', reason: 'port_in_use', version: null });
			expect(fakeProcess.stop).toHaveBeenCalled();
			expect(existsSync(yamlPath())).toBe(false);

			await jest.advanceTimersByTimeAsync(120_000);

			expect(fakeProcess.start).toHaveBeenCalledTimes(1);
		});

		it.each([
			['the old fixed config path', () => join(configDir, 'go2rtc', 'go2rtc.yaml')],
			['a path with another nonce', () => join(configDir, 'go2rtc', 'go2rtc-AAAAAAAAAAAAAAAAAAAAAA.yaml')],
		])('refuses a service that echoes %s', async (_name, foreignPath) => {
			client.getInfo.mockImplementation(() => Promise.resolve({ version: '1.9.9', configPath: foreignPath() }));

			await service.start();
			await settle();

			expect(service.getStatus()).toMatchObject({ state: 'error', reason: 'port_in_use', version: null });
			expect(fakeProcess.stop).toHaveBeenCalled();
			expect(service.getClient()).toBeNull();
		});

		it('uses a different random config file name for every spawn', async () => {
			await startRunning();

			const first = yamlPath();

			expect(first).toMatch(/\/go2rtc-[A-Za-z0-9_-]{22}\.yaml$/);
			expect(first.startsWith(`${goDir()}/`)).toBe(true);

			crash();
			await jest.advanceTimersByTimeAsync(GO2RTC_RESTART_BACKOFF_MS[0]);
			await settle();

			expect(fakeProcess.start).toHaveBeenCalledTimes(2);
			expect(yamlPath()).not.toBe(first);
			expect(yamlPath()).toMatch(/\/go2rtc-[A-Za-z0-9_-]{22}\.yaml$/);
			expect(configFiles()).toEqual([yamlPath().split('/').pop()]);
		});

		it('tightens an existing config directory to 0700', async () => {
			mkdirSync(goDir(), { recursive: true, mode: 0o755 });
			chmodSync(goDir(), 0o755);

			await service.start();

			expect(statSync(goDir()).mode & 0o777).toBe(0o700);
		});

		it('removes stale per-spawn config files before a spawn and leaves unrelated files alone', async () => {
			mkdirSync(goDir(), { recursive: true });
			writeFileSync(join(goDir(), 'go2rtc-STALEFILE0123456789ab.yaml'), 'streams: {}\n', { mode: 0o644 });
			writeFileSync(join(goDir(), 'notes.txt'), 'keep');

			await service.start();

			expect(configFiles()).toEqual([yamlPath().split('/').pop(), 'notes.txt'].sort());

			await service.stop();

			expect(configFiles()).toEqual(['notes.txt']);
		});

		it('never deletes the installation id when it removes per-spawn config files', async () => {
			const id = service.getInstallationId();

			expect(id).toMatch(/^[a-z0-9]{8}$/);
			expect(configFiles()).toEqual(['installation-id']);

			await service.start();

			expect(configFiles()).toEqual([yamlPath().split('/').pop(), 'installation-id'].sort());

			await service.stop();

			expect(configFiles()).toEqual(['installation-id']);
			expect(readFileSync(join(goDir(), 'installation-id'), 'utf8').trim()).toBe(id);
			expect(createService().getInstallationId()).toBe(id);
		});

		it('writes the instance secret as the first line of the config and keeps it out of the spawn arguments', async () => {
			await service.start();

			const secret = readInstanceSecret();

			expect(secret).toMatch(/^[A-Za-z0-9_-]{32}$/);
			expect(readFileSync(yamlPath(), 'utf8').split('\n')[0]).toBe(`# smart-panel-instance ${secret}`);
			expect(JSON.stringify(fakeProcess.start.mock.calls)).not.toContain(secret);
			expect(secrets.list()).toContain(secret);

			await service.stop();

			expect(secrets.list()).toEqual([]);
		});

		it('uses a new instance secret for every spawn', async () => {
			await startRunning();

			const first = readInstanceSecret();

			crash();
			await jest.advanceTimersByTimeAsync(GO2RTC_RESTART_BACKOFF_MS[0]);
			await settle();

			expect(readInstanceSecret()).not.toBe(first);
		});

		it('becomes running only after /api/config serves the instance line back', async () => {
			await startRunning();

			expect(client.getConfigText).toHaveBeenCalledTimes(1);
		});

		it.each([
			['no instance line', () => 'api:\n  listen: 127.0.0.1:41984\n'],
			['another instance secret', () => '# smart-panel-instance WRONGSECRET0123456789abcdefghij\napi:\n'],
			['the line only as part of another line', () => `x ${readFileSync(yamlPath(), 'utf8').split('\n')[0]}\napi:\n`],
		])('refuses a service with the right config_path but %s', async (_name, body) => {
			client.getConfigText.mockImplementation(() => Promise.resolve(body()));

			await service.start();
			await settle();

			expect(service.getStatus()).toMatchObject({ state: 'error', reason: 'port_in_use', version: null });
			expect(fakeProcess.stop).toHaveBeenCalled();
			expect(service.getClient()).toBeNull();
			expect(existsSync(yamlPath())).toBe(false);

			await jest.advanceTimersByTimeAsync(120_000);

			expect(fakeProcess.start).toHaveBeenCalledTimes(1);
		});

		it('keeps polling while /api/config cannot be read yet', async () => {
			client.getConfigText.mockRejectedValueOnce(new Go2rtcApiError(null));

			await service.start();
			await settle();

			expect(service.getStatus().state).toBe('starting');

			await jest.advanceTimersByTimeAsync(250);

			expect(service.getStatus().state).toBe('running');
		});

		it('checks the instance line at readiness only, not on the periodic probe', async () => {
			await startRunning();

			client.getConfigText.mockResolvedValue('api:\n');
			await jest.advanceTimersByTimeAsync(120_000);

			expect(client.getConfigText).toHaveBeenCalledTimes(1);
			expect(service.getStatus().state).toBe('running');
		});

		it('refuses a service that answers the unauthenticated probe when readiness times out', async () => {
			client.getInfo.mockRejectedValue(new Go2rtcApiError(401));
			probeClient.getInfo.mockRejectedValue(new Go2rtcApiError(401));

			await service.start();
			await jest.advanceTimersByTimeAsync(10_000);

			expect(service.getStatus()).toMatchObject({ state: 'error', reason: 'port_in_use' });
			expect(fakeProcess.stop).toHaveBeenCalled();

			await jest.advanceTimersByTimeAsync(120_000);

			expect(fakeProcess.start).toHaveBeenCalledTimes(1);
		});

		it('refuses a foreign service when the child exits during startup', async () => {
			client.getInfo.mockRejectedValue(new Go2rtcApiError(null));
			probeClient.getInfo.mockRejectedValue(new Go2rtcApiError(401));

			await service.start();
			crash();
			await settle();

			expect(service.getStatus()).toMatchObject({ state: 'error', reason: 'port_in_use' });

			await jest.advanceTimersByTimeAsync(120_000);

			expect(fakeProcess.start).toHaveBeenCalledTimes(1);
		});

		it('retries with crashed when the child exits during startup and nothing else answers', async () => {
			client.getInfo.mockRejectedValue(new Go2rtcApiError(null));

			await service.start();
			crash();
			await settle();

			expect(service.getStatus()).toMatchObject({ state: 'starting', reason: 'crashed' });

			await jest.advanceTimersByTimeAsync(1000);

			expect(fakeProcess.start).toHaveBeenCalledTimes(2);
		});

		it('reports start_timeout and retries when GET /api never answers', async () => {
			client.getInfo.mockRejectedValue(new Go2rtcApiError(null));

			await service.start();
			await jest.advanceTimersByTimeAsync(9_999);

			expect(service.getStatus()).toMatchObject({ state: 'starting', reason: null });

			await jest.advanceTimersByTimeAsync(1);

			expect(service.getStatus()).toMatchObject({ state: 'starting', reason: 'start_timeout' });
			expect(fakeProcess.stop).toHaveBeenCalled();
			expect(existsSync(yamlPath())).toBe(false);

			await jest.advanceTimersByTimeAsync(1000);

			expect(fakeProcess.start).toHaveBeenCalledTimes(2);
			expect(existsSync(yamlPath())).toBe(true);
		});

		it('gives up with start_timeout after the last backoff step when the relay never answers', async () => {
			client.getInfo.mockRejectedValue(new Go2rtcApiError(null));

			await service.start();

			for (const delay of GO2RTC_RESTART_BACKOFF_MS) {
				await jest.advanceTimersByTimeAsync(10_000);
				await jest.advanceTimersByTimeAsync(delay);
			}

			await jest.advanceTimersByTimeAsync(10_000);

			expect(service.getStatus()).toMatchObject({ state: 'error', reason: 'start_timeout' });
			expect(fakeProcess.start).toHaveBeenCalledTimes(GO2RTC_RESTART_BACKOFF_MS.length + 1);
		});

		it('restarts a crashed child with 1, 2, 4, 8, 16 s backoff and gives up with error crashed', async () => {
			await startRunning();

			for (const delay of GO2RTC_RESTART_BACKOFF_MS) {
				crash();
				await jest.advanceTimersByTimeAsync(delay - 1);

				const spawns = fakeProcess.start.mock.calls.length;

				await jest.advanceTimersByTimeAsync(1);
				await settle();

				expect(fakeProcess.start.mock.calls.length).toBe(spawns + 1);
				expect(service.getStatus()).toMatchObject({ state: 'running' });
			}

			crash();
			await jest.advanceTimersByTimeAsync(60_000);

			expect(service.getStatus()).toMatchObject({ state: 'error', reason: 'crashed' });
			expect(fakeProcess.start).toHaveBeenCalledTimes(GO2RTC_RESTART_BACKOFF_MS.length + 1);
			expect(existsSync(yamlPath())).toBe(false);
		});

		it('resets the attempt counter after 60 s of stable running', async () => {
			await startRunning();

			crash();
			await jest.advanceTimersByTimeAsync(1000);
			await settle();
			await jest.advanceTimersByTimeAsync(60_000);

			crash();
			await jest.advanceTimersByTimeAsync(999);

			const spawns = fakeProcess.start.mock.calls.length;

			await jest.advanceTimersByTimeAsync(1);
			await settle();

			expect(fakeProcess.start.mock.calls.length).toBe(spawns + 1);
		});

		it('keeps counting attempts when the child crashes again before 60 s', async () => {
			await startRunning();

			crash();
			await jest.advanceTimersByTimeAsync(1000);
			await settle();
			await jest.advanceTimersByTimeAsync(59_000);

			crash();
			await jest.advanceTimersByTimeAsync(1999);

			const spawns = fakeProcess.start.mock.calls.length;

			await jest.advanceTimersByTimeAsync(1);
			await settle();

			expect(fakeProcess.start.mock.calls.length).toBe(spawns + 1);
		});

		it('bumps the generation on every spawn and notifies subscribers of every change', async () => {
			const seen: Go2rtcRelayStatus[] = [];
			const unsubscribe = service.subscribe((status) => seen.push(status));

			await startRunning();

			const before = service.getStatus().generation;

			seen.length = 0;
			crash();
			await jest.advanceTimersByTimeAsync(1000);
			await settle();

			expect(seen.map((status) => status.state)).toEqual(['starting', 'starting', 'running']);
			expect(seen[0]).toMatchObject({ reason: 'crashed', generation: before });
			expect(seen[1]).toMatchObject({ reason: null, generation: before + 1 });
			expect(seen[2]).toMatchObject({ reason: null, generation: before + 1 });

			unsubscribe();
			seen.length = 0;
			crash();
			await settle();

			expect(seen).toEqual([]);
		});

		it('keeps the other subscribers working when one throws', async () => {
			const received = jest.fn();

			service.subscribe(() => {
				throw new Error('listener failed');
			});
			service.subscribe(received);

			await startRunning();

			expect(received).toHaveBeenCalled();
		});

		it('kills and restarts a child that stops answering the probe twice', async () => {
			await startRunning();

			client.getInfo.mockRejectedValue(new Go2rtcApiError(null));
			await jest.advanceTimersByTimeAsync(30_000);

			expect(fakeProcess.stop).not.toHaveBeenCalled();
			expect(service.getStatus().state).toBe('running');

			await jest.advanceTimersByTimeAsync(30_000);

			expect(fakeProcess.stop).toHaveBeenCalledWith(0);
			expect(service.getStatus()).toMatchObject({ state: 'starting', reason: 'crashed' });

			await jest.advanceTimersByTimeAsync(1000);

			expect(fakeProcess.start).toHaveBeenCalledTimes(2);
		});

		it('forgives a single failed probe', async () => {
			await startRunning();

			client.getInfo.mockRejectedValueOnce(new Go2rtcApiError(null));
			await jest.advanceTimersByTimeAsync(90_000);

			expect(fakeProcess.stop).not.toHaveBeenCalled();
			expect(service.getStatus().state).toBe('running');
		});

		it('notices an exit whose close has not been reported yet and ignores the stale report', async () => {
			await startRunning();

			const staleExit = fakeProcess.exitCallbacks[0];

			fakeProcess.running = false;
			await jest.advanceTimersByTimeAsync(30_000);

			expect(service.getStatus()).toMatchObject({ state: 'starting', reason: 'crashed' });

			await jest.advanceTimersByTimeAsync(1000);
			await settle();

			expect(fakeProcess.start).toHaveBeenCalledTimes(2);
			expect(service.getStatus().state).toBe('running');

			// The old child's `close` finally arrives, after the new spawn.
			staleExit({ code: 1, signal: null, spawnErrorCode: null });
			await jest.advanceTimersByTimeAsync(60_000);

			expect(service.getStatus().state).toBe('running');
			expect(fakeProcess.start).toHaveBeenCalledTimes(2);
			expect(fakeProcess.stop).toHaveBeenCalledTimes(1);
		});

		it('gives up and reports error when the child cannot be confirmed stopped', async () => {
			await startRunning();

			fakeProcess.stop.mockRejectedValueOnce(new Error('stuck'));
			crash();
			await jest.advanceTimersByTimeAsync(120_000);

			expect(service.getStatus()).toMatchObject({ state: 'error', reason: 'crashed' });
			expect(fakeProcess.start).toHaveBeenCalledTimes(1);
		});
	});

	describe('external relay', () => {
		beforeEach(() => {
			config.go2rtc = Object.assign(new CamerasGo2rtcConfigModel(), {
				mode: 'external',
				externalUrl: 'http://frigate.local:1984/',
			});
			client.getInfo.mockResolvedValue({ version: '1.9.8', configPath: null });
		});

		it('uses an external go2rtc without spawning and re-probes it every 30 s', async () => {
			await service.start();

			expect(createClientSpy).toHaveBeenCalledWith({ baseUrl: 'http://frigate.local:1984', authorization: null });
			expect(service.getStatus()).toMatchObject({ mode: 'external', state: 'running', reason: null, version: '1.9.8' });
			expect(service.getClient()).toBe(client);

			client.getInfo.mockRejectedValue(new Go2rtcApiError(null));
			await jest.advanceTimersByTimeAsync(30_000);

			expect(service.getStatus()).toMatchObject({ state: 'unavailable', reason: 'external_unreachable' });
			expect(service.getClient()).toBeNull();
			expect(fakeProcess.start).not.toHaveBeenCalled();
		});

		it('starts as unavailable, keeps probing and reconnects with a new generation', async () => {
			client.getInfo.mockRejectedValue(new Go2rtcApiError(null));

			await expect(service.start()).resolves.toBeUndefined();

			const before = service.getStatus();

			expect(before).toMatchObject({ state: 'unavailable', reason: 'external_unreachable' });

			client.getInfo.mockResolvedValue({ version: '1.9.8', configPath: null });
			await jest.advanceTimersByTimeAsync(30_000);

			expect(service.getStatus()).toMatchObject({ state: 'running', reason: null });
			expect(service.getStatus().generation).toBe(before.generation + 1);

			await jest.advanceTimersByTimeAsync(30_000);

			expect(service.getStatus().generation).toBe(before.generation + 1);
		});

		it('stops probing after stop()', async () => {
			await service.start();
			await service.stop();

			client.getInfo.mockClear();
			await jest.advanceTimersByTimeAsync(120_000);

			expect(client.getInfo).not.toHaveBeenCalled();
		});
	});

	describe('lifecycle', () => {
		it('is healthy while running or switched off, and unhealthy otherwise', async () => {
			await expect(service.isHealthy()).resolves.toBe(true);

			await startRunning();
			await expect(service.isHealthy()).resolves.toBe(true);

			crash();
			await settle();
			expect(service.getStatus().state).toBe('starting');
			await expect(service.isHealthy()).resolves.toBe(false);

			await service.stop();
			config.go2rtc.mode = 'disabled';
			await service.start();
			await expect(service.isHealthy()).resolves.toBe(true);
		});

		it('requires a restart only when the go2rtc settings change', async () => {
			await service.start();

			config.maxSessions = 2;
			expect(await service.onConfigChanged()).toEqual({ restartRequired: false });

			config.go2rtc.binaryPath = '/opt/go2rtc';
			expect(await service.onConfigChanged()).toEqual({ restartRequired: true });

			config.go2rtc.binaryPath = binaryPath;
			config.go2rtc.mode = 'external';
			expect(await service.onConfigChanged()).toEqual({ restartRequired: true });

			config.go2rtc.mode = 'managed';
			config.go2rtc.externalUrl = 'http://frigate.local:1984';
			expect(await service.onConfigChanged()).toEqual({ restartRequired: true });
		});

		it('bumps the generation on a mode change', async () => {
			await startRunning();

			const before = service.getStatus().generation;

			await service.stop();
			config.go2rtc.mode = 'disabled';
			await service.start();

			expect(service.getStatus()).toMatchObject({ mode: 'disabled', state: 'disabled', reason: 'mode_disabled' });
			expect(service.getStatus().generation).toBeGreaterThan(before);
		});

		it('reports module_disabled after stop, exposes no client and removes the config file', async () => {
			await startRunning();

			expect(existsSync(yamlPath())).toBe(true);

			await service.stop();

			expect(service.getStatus()).toMatchObject({ state: 'disabled', reason: 'module_disabled', version: null });
			expect(service.getClient()).toBeNull();
			expect(service.getState()).toBe('stopped');
			expect(fakeProcess.stop).toHaveBeenCalled();
			expect(existsSync(yamlPath())).toBe(false);
		});

		it('cancels a pending respawn when stopped during the backoff', async () => {
			await startRunning();
			crash();
			await settle();
			await service.stop();
			await jest.advanceTimersByTimeAsync(120_000);

			expect(fakeProcess.start).toHaveBeenCalledTimes(1);
			expect(service.getStatus()).toMatchObject({ state: 'disabled', reason: 'module_disabled' });
		});

		it('starts again after stop and removes the config file again on module destroy', async () => {
			await startRunning();
			await service.stop();
			await service.start();
			await settle();

			expect(service.getStatus().state).toBe('running');
			expect(existsSync(yamlPath())).toBe(true);

			await service.onModuleDestroy();

			expect(existsSync(yamlPath())).toBe(false);
			expect(service.getStatus().state).toBe('disabled');
		});

		it('rejects stop only when the child cannot be confirmed terminated, and start refuses to spawn alongside it', async () => {
			await startRunning();

			fakeProcess.stop.mockRejectedValueOnce(new Error('stuck'));
			fakeProcess.running = true;

			await expect(service.stop()).rejects.toBeInstanceOf(Go2rtcUnavailableException);

			expect(service.getState()).toBe('error');
			expect(service.getStatus()).toMatchObject({ state: 'error' });

			await expect(service.start()).rejects.toBeInstanceOf(Go2rtcUnavailableException);
			expect(fakeProcess.start).toHaveBeenCalledTimes(1);
		});

		it('is a no-op to stop a service that never started', async () => {
			await expect(service.stop()).resolves.toBeUndefined();

			expect(fakeProcess.stop).not.toHaveBeenCalled();
		});
	});

	describe('secret hygiene', () => {
		it('never logs the api password or an unredacted source url', async () => {
			await startRunning();

			const passwords: string[] = [];
			const instanceSecrets: string[] = [];
			const statuses: Go2rtcRelayStatus[] = [];

			service.subscribe((status) => statuses.push(status));

			// Crash the child until the service gives up; every ring tail carries the sentinels.
			for (let attempt = 0; attempt <= GO2RTC_RESTART_BACKOFF_MS.length; attempt++) {
				const password = readPassword();

				const instanceSecret = readInstanceSecret();

				passwords.push(password);
				instanceSecrets.push(instanceSecret);
				fakeProcess.lines = [`source ${FAKE_CAMERA_SECRET_URL}`, `auth ${password}`, `instance ${instanceSecret}`];
				crash();
				await jest.advanceTimersByTimeAsync(GO2RTC_RESTART_BACKOFF_MS[attempt] ?? 0);
				await settle();
			}

			expect(service.getStatus()).toMatchObject({ state: 'error', reason: 'crashed' });
			expect(new Set(passwords).size).toBe(passwords.length);

			const logged = loggedCalls();

			expect(logged).toContain('go2rtc output:');
			expect(logged).not.toContain('SENTINELALIAS');

			for (const secret of [...passwords, ...instanceSecrets]) {
				expect(logged).not.toContain(secret);
				expect(JSON.stringify(statuses)).not.toContain(secret);
			}
		});

		it('never logs the external url', async () => {
			config.go2rtc = Object.assign(new CamerasGo2rtcConfigModel(), {
				mode: 'external',
				externalUrl: 'http://SENTINELHOST.example:1984',
			});
			client.getInfo.mockRejectedValue(new Go2rtcApiError(null));

			await service.start();
			await service.stop();

			expect(loggedCalls()).not.toContain('SENTINELHOST');
		});
	});
});

describe('Go2rtcService with the stub binary', () => {
	jest.setTimeout(30_000);

	let workDir: string;
	let service: Go2rtcService | null = null;
	let config: CamerasConfigModel;
	let nestConfig: { get: jest.Mock };
	let secrets: Go2rtcSecretsRegistry;
	let processService: Go2rtcProcessService;

	const stubConfigFiles = (): string[] => {
		const dir = join(workDir, 'config', 'go2rtc');

		return existsSync(dir) ? readdirSync(dir) : [];
	};

	async function freePort(): Promise<number> {
		const server = createServer();

		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

		const { port } = server.address() as { port: number };

		await new Promise<void>((resolve) => server.close(() => resolve()));

		return port;
	}

	async function waitFor(predicate: () => boolean, timeoutMs = 15_000): Promise<void> {
		const startedAt = Date.now();

		while (!predicate()) {
			if (Date.now() - startedAt > timeoutMs) {
				throw new Error('waitFor() timed out');
			}

			await new Promise((resolve) => setTimeout(resolve, 25));
		}
	}

	async function createService(options: StubGo2rtcOptions = {}): Promise<Go2rtcService> {
		const port = await freePort();
		const binaryPath = writeStubGo2rtcScript(workDir, 'serve', options);

		config = Object.assign(new CamerasConfigModel(), {
			go2rtc: Object.assign(new CamerasGo2rtcConfigModel(), { mode: 'managed', binaryPath }),
		});
		nestConfig = {
			get: jest.fn((key: string) => {
				const values: Record<string, unknown> = {
					FB_GO2RTC_API_PORT: port,
					FB_GO2RTC_RTSP_PORT: 41985,
					FB_CONFIG_PATH: join(workDir, 'config'),
				};

				return values[key];
			}),
		};
		secrets = new Go2rtcSecretsRegistry();
		processService = new Go2rtcProcessService(secrets);

		return new Go2rtcService(
			{ getModuleConfig: jest.fn(() => config) } as never,
			nestConfig as never,
			processService,
			secrets,
		);
	}

	beforeEach(() => {
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

		workDir = mkdtempSync(join(tmpdir(), 'go2rtc-service-stub-'));
	});

	afterEach(async () => {
		await service?.stop().catch(() => undefined);

		service = null;
		jest.restoreAllMocks();
		rmSync(workDir, { recursive: true, force: true });
	});

	it('starts the stub binary, authenticates and reaches running', async () => {
		service = await createService();

		await service.start();
		await waitFor(() => service.getStatus().state !== 'starting');

		expect(service.getStatus()).toMatchObject({
			mode: 'managed',
			state: 'running',
			reason: null,
			version: '1.9.9-stub',
		});
		expect(service.getClient()).toBeInstanceOf(Go2rtcApiClient);
		expect(stubConfigFiles()).toHaveLength(1);

		// The instance secret is in the file but in neither the spawn arguments nor the (redacted) output ring.
		const configFile = join(workDir, 'config', 'go2rtc', stubConfigFiles()[0]);
		const secret = /^# smart-panel-instance (\S+)$/m.exec(readFileSync(configFile, 'utf8'))?.[1] ?? '';

		expect(secret).toHaveLength(32);
		expect(processService.getOutputLines().some((line) => line.startsWith('stub argv='))).toBe(true);
		expect(processService.getOutputLines().join('\n')).not.toContain(secret);

		await service.stop();

		expect(service.getStatus()).toMatchObject({ state: 'disabled', reason: 'module_disabled' });
		expect(stubConfigFiles()).toEqual([]);
		expect(secrets.list()).toEqual([]);
	});

	it('refuses a stub that echoes the right config_path but serves a config without the instance secret', async () => {
		// The squatter learns the path from the process arguments, but cannot read the 0600 file.
		service = await createService({ reportedConfigText: 'api:\n  listen: 127.0.0.1:1\n' });

		await service.start();
		await waitFor(() => service.getStatus().state !== 'starting');

		expect(service.getStatus()).toMatchObject({ state: 'error', reason: 'port_in_use' });
		expect(stubConfigFiles()).toEqual([]);
	});

	it('refuses a stub that echoes the old fixed config path', async () => {
		// A squatter that guesses the old fixed config path.
		service = await createService({ reportedConfigPath: join(workDir, 'config', 'go2rtc', 'go2rtc.yaml') });

		await service.start();
		await waitFor(() => service.getStatus().state !== 'starting');

		expect(service.getStatus()).toMatchObject({ state: 'error', reason: 'port_in_use' });
		expect(stubConfigFiles()).toEqual([]);
	});
});
