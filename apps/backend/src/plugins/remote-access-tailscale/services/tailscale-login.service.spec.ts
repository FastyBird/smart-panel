/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { EventEmitter } from 'events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import * as fsPromises from 'node:fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { TAILSCALE_DATA_SUBDIR } from '../remote-access-tailscale.constants';

import { TailscaleCliError, TailscaleCliService } from './tailscale-cli.service';
import {
	TailscaleLoginInProgressException,
	TailscaleLoginService,
	extractJsonObjects,
} from './tailscale-login.service';
import { TailscaleNodeManagedService } from './tailscale-node-managed.service';

// Node's native ES module exports are non-configurable, so a plain
// jest.spyOn(fsPromises, 'writeFile') cannot redefine it directly (throws
// "Cannot redefine property"). Wrapping it as a jest.fn() around the real
// implementation, up front, keeps every other test's real file I/O working
// while still letting one test below override its behaviour with
// mockImplementationOnce.
jest.mock('node:fs/promises', () => {
	const actual = jest.requireActual<typeof import('node:fs/promises')>('node:fs/promises');

	return { ...actual, writeFile: jest.fn(actual.writeFile) };
});

const SECRET_AUTH_KEY = 'tskey-auth-kABCDE1234-verysecretsuffixvalue123456';

// All three timeouts are shrunk to real, sub-second values for this whole
// file. Everything here uses real (not fake) timers throughout: the
// auth-key flow awaits real `fs/promises` calls before it ever reaches
// `cli.spawnUp()`, and those go through libuv's thread pool — a scenario
// fake timers cannot safely interleave with (they intercept
// setTimeout/setImmediate, but real disk I/O completion is independent of
// the JS timer system, so `waitUntil` below still needs a *real* setTimeout
// to yield the event loop). Shrinking the constants keeps the genuine
// timeout tests fast without fake time. TAILSCALE_LOGIN_FIRST_BLOCK_TIMEOUT_MS
// is kept well below TAILSCALE_LOGIN_INTERACTIVE_TIMEOUT_MS, same as in
// production, so the two never race in the "first block never arrives"
// tests below.
jest.mock('../remote-access-tailscale.constants', () => ({
	...jest.requireActual<typeof import('../remote-access-tailscale.constants')>('../remote-access-tailscale.constants'),
	TAILSCALE_LOGIN_AUTH_KEY_TIMEOUT_MS: 50,
	TAILSCALE_LOGIN_INTERACTIVE_TIMEOUT_MS: 50,
	TAILSCALE_LOGIN_FIRST_BLOCK_TIMEOUT_MS: 15,
}));

/** Minimal stand-in for ChildProcessWithoutNullStreams: an EventEmitter with stdout/stderr sub-emitters and a kill() spy. */
class FakeChildProcess extends EventEmitter {
	stdout = Object.assign(new EventEmitter(), { resume: jest.fn() });
	stderr = Object.assign(new EventEmitter(), { resume: jest.fn() });
	kill = jest.fn();
}

function flushMicrotasks(): Promise<void> {
	return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Polls until `predicate()` is true. `loginWithAuthKey()` awaits real
 * `fs/promises` calls (mkdir, writeFile) before it ever reaches
 * `cli.spawnUp()` — those go through libuv's thread pool, so a single
 * microtask/setImmediate flush is not reliably enough ticks for them to
 * land. Polling with a real (short) timer, rather than asserting right
 * after one flush, avoids leaving a dangling in-flight write that would
 * otherwise race the next test's temp-dir cleanup.
 */
async function waitUntil(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
	const start = Date.now();

	while (!predicate()) {
		if (Date.now() - start > timeoutMs) {
			throw new Error('waitUntil: condition not met within timeout');
		}

		await new Promise((resolve) => setTimeout(resolve, 5));
	}
}

describe('extractJsonObjects', () => {
	it('extracts a single compact object with nothing left over', () => {
		const { objects, rest } = extractJsonObjects('{"BackendState":"Running"}');

		expect(objects).toEqual(['{"BackendState":"Running"}']);
		expect(rest).toBe('');
	});

	it('extracts two pretty-printed objects printed back to back', () => {
		const buffer =
			'{\n\t"AuthURL": "https://login.tailscale.com/a/xyz",\n\t"QR": "data:image/png;base64,AAA",\n\t"BackendState": "NeedsLogin"\n}\n{\n\t"BackendState": "Running"\n}\n';

		const { objects, rest } = extractJsonObjects(buffer);

		expect(objects).toHaveLength(2);
		expect(JSON.parse(objects[0])).toMatchObject({ BackendState: 'NeedsLogin' });
		expect(JSON.parse(objects[1])).toMatchObject({ BackendState: 'Running' });
		expect(rest.trim()).toBe('');
	});

	it('leaves a partial trailing object as rest for the next chunk', () => {
		const { objects, rest } = extractJsonObjects('{"BackendState":"Running"}{"Backend');

		expect(objects).toEqual(['{"BackendState":"Running"}']);
		expect(rest).toBe('{"Backend');
	});

	it('does not mistake a brace inside a quoted string for structure', () => {
		const { objects, rest } = extractJsonObjects('{"Health":["{not real structure}"],"BackendState":"Running"}');

		expect(objects).toHaveLength(1);
		expect(JSON.parse(objects[0])).toMatchObject({ BackendState: 'Running' });
		expect(rest).toBe('');
	});

	it('handles an escaped quote inside a string without losing track of depth', () => {
		const { objects } = extractJsonObjects('{"Note":"a \\"quoted\\" word with a } brace"}');

		expect(objects).toHaveLength(1);
		expect(JSON.parse(objects[0])).toMatchObject({ Note: 'a "quoted" word with a } brace' });
	});
});

describe('TailscaleLoginService', () => {
	let service: TailscaleLoginService;
	// spawnUp is given an explicit generic (return, args) instead of a bare
	// jest.Mock so `cli.spawnUp.mock.calls[0][0]` below resolves to
	// `string[]` instead of `any` — see the file-level note in
	// tailscale-setup.service.spec.ts for the same pattern.
	let cli: { spawnUp: jest.Mock<FakeChildProcess, [string[]]>; up: jest.Mock; logout: jest.Mock };
	let nodeManagedService: { computeStatus: jest.Mock; getPluginConfig: jest.Mock; buildUpFlags: jest.Mock };
	let nestConfigServiceMock: { get: jest.Mock };
	let dataDir: string;
	let warnSpy: jest.SpyInstance;
	let errorSpy: jest.SpyInstance;

	beforeEach(async () => {
		dataDir = mkdtempSync(join(tmpdir(), 'ra5-login-'));

		cli = {
			spawnUp: jest.fn<FakeChildProcess, [string[]]>(),
			up: jest.fn().mockResolvedValue(undefined),
			logout: jest.fn().mockResolvedValue(undefined),
		};

		nodeManagedService = {
			computeStatus: jest.fn().mockResolvedValue({ state: 'setup-required' }),
			getPluginConfig: jest.fn().mockReturnValue({}),
			buildUpFlags: jest.fn().mockReturnValue(['--hostname=panel', '--operator=smart-panel']),
		};

		nestConfigServiceMock = {
			get: jest.fn().mockImplementation((key: string) => (key === 'FB_DATA_DIR' ? dataDir : undefined)),
		};

		// jest.setup.ts already silences Logger.prototype for every unit test;
		// re-spy here (fresh, still silent) so this file's own mock.calls are
		// isolated from anything logged during module setup.
		warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TailscaleLoginService,
				{ provide: TailscaleCliService, useValue: cli },
				{ provide: TailscaleNodeManagedService, useValue: nodeManagedService },
				{ provide: NestConfigService, useValue: nestConfigServiceMock },
			],
		}).compile();

		service = module.get<TailscaleLoginService>(TailscaleLoginService);
	});

	afterEach(() => {
		rmSync(dataDir, { recursive: true, force: true });
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('login with an auth key', () => {
		it('writes the key to a 0600 file under <FB_DATA_DIR>/remote-access, passes it as file:<path>, and removes it on success', async () => {
			const child = new FakeChildProcess();
			cli.spawnUp.mockReturnValue(child);

			const loginPromise = service.login(SECRET_AUTH_KEY);

			await waitUntil(() => cli.spawnUp.mock.calls.length > 0);

			expect(cli.spawnUp).toHaveBeenCalledTimes(1);
			const args = cli.spawnUp.mock.calls[0][0];
			const keyArg = args.find((a) => a.startsWith('--auth-key=file:'));

			expect(keyArg).toBeDefined();
			const keyFilePath = keyArg.slice('--auth-key=file:'.length);

			expect(existsSync(keyFilePath)).toBe(true);
			expect(readFileSync(keyFilePath, 'utf8')).toBe(SECRET_AUTH_KEY);
			expect(statSync(keyFilePath).mode & 0o777).toBe(0o600);
			expect(args).toContain('--timeout=120s');
			expect(args).toEqual(expect.arrayContaining(['--hostname=panel', '--operator=smart-panel']));

			child.emit('close', 0);

			const result = await loginPromise;

			expect(result).toEqual({ state: 'setup-required' });
			expect(existsSync(keyFilePath)).toBe(false);
		});

		it('never puts the raw key anywhere but the ephemeral file: not in spawnUp args, not logged, not in the result', async () => {
			const child = new FakeChildProcess();
			cli.spawnUp.mockReturnValue(child);

			const loginPromise = service.login(SECRET_AUTH_KEY);

			await waitUntil(() => cli.spawnUp.mock.calls.length > 0);

			const args = cli.spawnUp.mock.calls[0][0];

			expect(args.some((a) => a.includes(SECRET_AUTH_KEY))).toBe(false);

			child.emit('close', 0);

			const result = await loginPromise;

			expect(JSON.stringify(result)).not.toContain(SECRET_AUTH_KEY);

			const allLogCalls = [...(warnSpy.mock.calls as unknown[][]), ...(errorSpy.mock.calls as unknown[][])].flat();

			expect(allLogCalls.some((arg) => typeof arg === 'string' && arg.includes(SECRET_AUTH_KEY))).toBe(false);
		});

		it('deletes the key file if writeFile itself throws after creating it (a partial write)', async () => {
			const realWriteFile = jest.requireActual<typeof import('node:fs/promises')>('node:fs/promises').writeFile;
			const writeFileMock = fsPromises.writeFile as jest.Mock<Promise<void>, [string, string, unknown]>;

			writeFileMock.mockImplementationOnce(async (path, data, options) => {
				await realWriteFile(path, data, options);
				throw new Error('simulated partial write failure');
			});

			await expect(service.login(SECRET_AUTH_KEY)).rejects.toThrow('simulated partial write failure');

			const writtenPath = writeFileMock.mock.calls[0][0];

			expect(existsSync(writtenPath)).toBe(false);
			expect(cli.spawnUp).not.toHaveBeenCalled();
		});

		it('deletes the key file and still returns the resulting status when up exits non-zero', async () => {
			const child = new FakeChildProcess();
			cli.spawnUp.mockReturnValue(child);

			const loginPromise = service.login(SECRET_AUTH_KEY);

			await waitUntil(() => cli.spawnUp.mock.calls.length > 0);

			const args = cli.spawnUp.mock.calls[0][0];
			const keyFilePath = args.find((a) => a.startsWith('--auth-key=file:')).slice('--auth-key=file:'.length);

			child.emit('close', 1);

			const result = await loginPromise;

			expect(result).toEqual({ state: 'setup-required' });
			expect(existsSync(keyFilePath)).toBe(false);
			expect(warnSpy).toHaveBeenCalled();
		});

		it('deletes the key file and still returns the resulting status on a spawn error', async () => {
			const child = new FakeChildProcess();
			cli.spawnUp.mockReturnValue(child);

			const loginPromise = service.login(SECRET_AUTH_KEY);

			await waitUntil(() => cli.spawnUp.mock.calls.length > 0);

			const args = cli.spawnUp.mock.calls[0][0];
			const keyFilePath = args.find((a) => a.startsWith('--auth-key=file:')).slice('--auth-key=file:'.length);

			child.emit('error', new Error('spawn tailscale ENOENT'));

			const result = await loginPromise;

			expect(result).toEqual({ state: 'setup-required' });
			expect(existsSync(keyFilePath)).toBe(false);
		});

		it('deletes the key file and still returns the resulting status on a timeout, killing the child', async () => {
			const child = new FakeChildProcess();
			cli.spawnUp.mockReturnValue(child);

			const loginPromise = service.login(SECRET_AUTH_KEY);

			await waitUntil(() => cli.spawnUp.mock.calls.length > 0);

			const args = cli.spawnUp.mock.calls[0][0];
			const keyFilePath = args.find((a) => a.startsWith('--auth-key=file:')).slice('--auth-key=file:'.length);

			// Never emits close/error — the mocked 50ms constant fires instead.
			const result = await loginPromise;

			expect(result).toEqual({ state: 'setup-required' });
			expect(child.kill).toHaveBeenCalledWith('SIGTERM');
			expect(existsSync(keyFilePath)).toBe(false);
		}, 10_000);

		it('cancels a pending interactive login before spawning, so at most one `tailscale up` runs at a time', async () => {
			const interactiveChild = new FakeChildProcess();

			cli.spawnUp.mockReturnValueOnce(interactiveChild);

			const interactivePromise = service.login();

			await flushMicrotasks();
			interactiveChild.stdout.emit(
				'data',
				Buffer.from(
					'{"AuthURL":"https://login.tailscale.com/a/abc","QR":"data:image/png;base64,QQQ","BackendState":"NeedsLogin"}',
				),
			);
			await interactivePromise;

			expect(service.getPendingInteractiveAuth()).not.toBeNull();

			const keyedChild = new FakeChildProcess();

			cli.spawnUp.mockReturnValueOnce(keyedChild);

			const keyedPromise = service.login(SECRET_AUTH_KEY);

			// The interactive child must be killed synchronously, before the
			// keyed spawn even starts writing the key file — not merely by the
			// time the whole call settles.
			expect(interactiveChild.kill).toHaveBeenCalledWith('SIGTERM');
			expect(service.getPendingInteractiveAuth()).toBeNull();

			await waitUntil(() => cli.spawnUp.mock.calls.length > 1);
			expect(cli.spawnUp).toHaveBeenCalledTimes(2);

			keyedChild.emit('close', 0);

			await keyedPromise;
		});

		it('rejects a second keyed login while one is already running, without spawning a second `up`', async () => {
			const firstChild = new FakeChildProcess();

			cli.spawnUp.mockReturnValueOnce(firstChild);

			const firstPromise = service.login(SECRET_AUTH_KEY);

			await waitUntil(() => cli.spawnUp.mock.calls.length > 0);

			await expect(service.login(SECRET_AUTH_KEY)).rejects.toBeInstanceOf(TailscaleLoginInProgressException);
			expect(cli.spawnUp).toHaveBeenCalledTimes(1);

			firstChild.emit('close', 0);

			await firstPromise;
		});

		it('rejects an interactive login while a keyed one is running, without spawning a concurrent `up --json`', async () => {
			const keyedChild = new FakeChildProcess();

			cli.spawnUp.mockReturnValueOnce(keyedChild);

			const keyedPromise = service.login(SECRET_AUTH_KEY);

			await waitUntil(() => cli.spawnUp.mock.calls.length > 0);

			await expect(service.login()).rejects.toBeInstanceOf(TailscaleLoginInProgressException);
			expect(cli.spawnUp).toHaveBeenCalledTimes(1);
			expect(service.getPendingInteractiveAuth()).toBeNull();

			keyedChild.emit('close', 0);

			await keyedPromise;
		});

		it('allows a new login (either mode) once the in-flight keyed one has completed', async () => {
			const firstChild = new FakeChildProcess();

			cli.spawnUp.mockReturnValueOnce(firstChild);

			const firstPromise = service.login(SECRET_AUTH_KEY);

			await waitUntil(() => cli.spawnUp.mock.calls.length > 0);

			firstChild.emit('close', 0);

			await firstPromise;

			const secondChild = new FakeChildProcess();

			cli.spawnUp.mockReturnValueOnce(secondChild);

			const secondPromise = service.login(SECRET_AUTH_KEY);

			await waitUntil(() => cli.spawnUp.mock.calls.length > 1);
			expect(cli.spawnUp).toHaveBeenCalledTimes(2);

			secondChild.emit('close', 0);

			await expect(secondPromise).resolves.toEqual({ state: 'setup-required' });
		});
	});

	describe('interactive login (no key)', () => {
		it('resolves pending-auth with the auth URL and QR parsed from the first (pretty-printed) block', async () => {
			const child = new FakeChildProcess();
			cli.spawnUp.mockReturnValue(child);

			const loginPromise = service.login();

			await flushMicrotasks();

			expect(cli.spawnUp).toHaveBeenCalledWith(expect.arrayContaining(['--json', '--timeout=10m']));

			const block1 =
				'{\n\t"AuthURL": "https://login.tailscale.com/a/0123456789abcdef",\n\t"QR": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA",\n\t"BackendState": "NeedsLogin"\n}\n';

			// Split across two chunks to exercise incremental buffering.
			child.stdout.emit('data', Buffer.from(block1.slice(0, 15)));
			child.stdout.emit('data', Buffer.from(block1.slice(15)));

			const result = await loginPromise;

			expect(result).toEqual({
				state: 'pending-auth',
				authUrl: 'https://login.tailscale.com/a/0123456789abcdef',
				qr: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA',
			});
		});

		it('reports the pending auth URL from GET-status-style accessor while waiting for the second block', async () => {
			const child = new FakeChildProcess();
			cli.spawnUp.mockReturnValue(child);

			const loginPromise = service.login();

			await flushMicrotasks();
			child.stdout.emit(
				'data',
				Buffer.from(
					'{"AuthURL":"https://login.tailscale.com/a/abc","QR":"data:image/png;base64,QQQ","BackendState":"NeedsLogin"}',
				),
			);
			await loginPromise;

			expect(service.getPendingInteractiveAuth()).toEqual({
				authUrl: 'https://login.tailscale.com/a/abc',
				qr: 'data:image/png;base64,QQQ',
			});
		});

		it('clears the pending auth on the second block', async () => {
			const child = new FakeChildProcess();
			cli.spawnUp.mockReturnValue(child);

			const loginPromise = service.login();

			await flushMicrotasks();
			child.stdout.emit(
				'data',
				Buffer.from(
					'{"AuthURL":"https://login.tailscale.com/a/abc","QR":"data:image/png;base64,QQQ","BackendState":"NeedsLogin"}',
				),
			);
			await loginPromise;

			expect(service.getPendingInteractiveAuth()).not.toBeNull();

			child.stdout.emit('data', Buffer.from('{"BackendState":"Running"}'));
			await flushMicrotasks();

			expect(service.getPendingInteractiveAuth()).toBeNull();
			expect(child.kill).toHaveBeenCalledWith('SIGTERM');
		});

		it('falls back to the real status when the first block has no AuthURL (already authenticated)', async () => {
			const child = new FakeChildProcess();
			cli.spawnUp.mockReturnValue(child);
			nodeManagedService.computeStatus.mockResolvedValue({ state: 'connected' });

			const loginPromise = service.login();

			await flushMicrotasks();
			child.stdout.emit('data', Buffer.from('{"BackendState":"Running"}'));

			const result = await loginPromise;

			expect(result).toEqual({ state: 'connected' });
			expect(service.getPendingInteractiveAuth()).toBeNull();
		});

		it('rejects the caller with an error, propagated by the controller, when the process errors before any block', async () => {
			const child = new FakeChildProcess();
			cli.spawnUp.mockReturnValue(child);

			const loginPromise = service.login();

			await flushMicrotasks();
			child.emit('error', new Error('spawn tailscale ENOENT'));

			await expect(loginPromise).rejects.toThrow('spawn tailscale ENOENT');
		});

		it('only one pending login at a time — a second call while pending returns the same URL instead of spawning again', async () => {
			const child = new FakeChildProcess();
			cli.spawnUp.mockReturnValue(child);

			const firstPromise = service.login();

			await flushMicrotasks();
			child.stdout.emit(
				'data',
				Buffer.from(
					'{"AuthURL":"https://login.tailscale.com/a/abc","QR":"data:image/png;base64,QQQ","BackendState":"NeedsLogin"}',
				),
			);
			await firstPromise;

			const secondResult = await service.login();

			expect(secondResult).toEqual({
				state: 'pending-auth',
				authUrl: 'https://login.tailscale.com/a/abc',
				qr: 'data:image/png;base64,QQQ',
			});
			expect(cli.spawnUp).toHaveBeenCalledTimes(1);
		});

		describe('first-block timeout (mocked to 15ms, well under the 50ms overall timeout)', () => {
			it('resolves pending-auth with no URL when the child never prints, leaving the child and the marker in place', async () => {
				const child = new FakeChildProcess();
				cli.spawnUp.mockReturnValue(child);

				const loginPromise = service.login();

				// Never emits any data — the mocked 15ms first-block constant
				// fires instead of the (larger, also mocked) 50ms overall
				// interactive timeout.
				const result = await loginPromise;

				expect(result).toEqual({ state: 'pending-auth' });
				expect(result.authUrl).toBeUndefined();
				expect(result.qr).toBeUndefined();

				// The sign-in is still running, not torn down: stopPendingLogin()
				// was never called for this settlement path.
				expect(child.kill).not.toHaveBeenCalled();
				expect(service['pending']).not.toBeNull();
				expect(service['pending']?.child).toBe(child);

				// getPendingInteractiveAuth() only surfaces an auth URL once one
				// is actually known — there isn't one yet.
				expect(service.getPendingInteractiveAuth()).toBeNull();
			});

			it('stores the auth URL/QR when the first block arrives after the first-block timeout already resolved the request, without spawning again', async () => {
				const child = new FakeChildProcess();
				cli.spawnUp.mockReturnValue(child);

				const loginPromise = service.login();

				const result = await loginPromise; // settles via the first-block timeout

				expect(result).toEqual({ state: 'pending-auth' });

				child.stdout.emit(
					'data',
					Buffer.from(
						'{"AuthURL":"https://login.tailscale.com/a/abc","QR":"data:image/png;base64,QQQ","BackendState":"NeedsLogin"}',
					),
				);
				await flushMicrotasks();

				expect(service.getPendingInteractiveAuth()).toEqual({
					authUrl: 'https://login.tailscale.com/a/abc',
					qr: 'data:image/png;base64,QQQ',
				});
				expect(cli.spawnUp).toHaveBeenCalledTimes(1);
			});

			it('releases the marker when the child exits after the first-block timeout already resolved the request', async () => {
				const child = new FakeChildProcess();
				cli.spawnUp.mockReturnValue(child);

				const loginPromise = service.login();

				await loginPromise;

				child.emit('close', 0);
				await flushMicrotasks();

				expect(service.getPendingInteractiveAuth()).toBeNull();
				expect(service['pending']).toBeNull();
			});

			it('a first block with no AuthURL arriving after the first-block timeout still falls back to the real status and releases the marker', async () => {
				const child = new FakeChildProcess();
				cli.spawnUp.mockReturnValue(child);
				nodeManagedService.computeStatus.mockResolvedValue({ state: 'connected' });

				const loginPromise = service.login();

				await loginPromise; // settles pending-auth via the first-block timeout

				child.stdout.emit('data', Buffer.from('{"BackendState":"Running"}'));
				await flushMicrotasks();

				expect(service.getPendingInteractiveAuth()).toBeNull();
				expect(service['pending']).toBeNull();
				expect(child.kill).toHaveBeenCalledWith('SIGTERM');
			});
		});

		it('the 10-minute ceiling still kills the child and clears pending state in the background once it elapses, even though the request already settled via the first-block timeout', async () => {
			const child = new FakeChildProcess();
			cli.spawnUp.mockReturnValue(child);

			const loginPromise = service.login();

			// Never emits any data. The mocked 15ms first-block timeout settles
			// the request first (with no URL, asserted elsewhere) — the
			// mocked 50ms overall ceiling that used to be observable as a
			// rejection here can no longer reject an already-settled promise,
			// but it must still fire in the background and finish tearing
			// down the child/pending state exactly as before.
			await expect(loginPromise).resolves.toEqual({ state: 'pending-auth' });

			await waitUntil(() => child.kill.mock.calls.length > 0);

			expect(child.kill).toHaveBeenCalledWith('SIGTERM');
			expect(service.getPendingInteractiveAuth()).toBeNull();
			expect(service['pending']).toBeNull();
		}, 10_000);

		it('stopPendingLogin() kills the child and clears state while a login is pending', async () => {
			const child = new FakeChildProcess();
			cli.spawnUp.mockReturnValue(child);

			const loginPromise = service.login();

			await flushMicrotasks();
			child.stdout.emit(
				'data',
				Buffer.from(
					'{"AuthURL":"https://login.tailscale.com/a/abc","QR":"data:image/png;base64,QQQ","BackendState":"NeedsLogin"}',
				),
			);
			await loginPromise;

			service.stopPendingLogin();

			expect(child.kill).toHaveBeenCalledWith('SIGTERM');
			expect(service.getPendingInteractiveAuth()).toBeNull();
		});

		it('stopPendingLogin() is a safe no-op when nothing is pending', () => {
			expect(() => service.stopPendingLogin()).not.toThrow();
			expect(service.getPendingInteractiveAuth()).toBeNull();
		});
	});

	describe('logout', () => {
		it('cancels a pending login, runs tailscale logout, and returns the resulting status', async () => {
			const child = new FakeChildProcess();
			cli.spawnUp.mockReturnValue(child);

			const loginPromise = service.login();

			await flushMicrotasks();
			child.stdout.emit(
				'data',
				Buffer.from(
					'{"AuthURL":"https://login.tailscale.com/a/abc","QR":"data:image/png;base64,QQQ","BackendState":"NeedsLogin"}',
				),
			);
			await loginPromise;

			nodeManagedService.computeStatus.mockResolvedValue({ state: 'setup-required' });

			const result = await service.logout();

			expect(child.kill).toHaveBeenCalledWith('SIGTERM');
			expect(service.getPendingInteractiveAuth()).toBeNull();
			expect(cli.logout).toHaveBeenCalledTimes(1);
			expect(result).toEqual({ state: 'setup-required' });
		});

		it('tolerates the needs-login kind (nothing to sign out of) and still returns the resulting status', async () => {
			cli.logout.mockRejectedValue(new TailscaleCliError('needs-login', 'not logged in'));
			nodeManagedService.computeStatus.mockResolvedValue({ state: 'not-installed' });

			const result = await service.logout();

			expect(result).toEqual({ state: 'not-installed' });
		});

		it.each<['daemon-down' | 'permission-denied' | 'timeout' | 'unknown', string]>([
			['daemon-down', 'connection refused'],
			['permission-denied', 'access denied'],
			['timeout', 'tailscale logout did not complete within 15000ms'],
			['unknown', 'boom'],
		])('propagates a genuine %s failure instead of swallowing it', async (kind, message) => {
			cli.logout.mockRejectedValue(new TailscaleCliError(kind, message));

			await expect(service.logout()).rejects.toMatchObject({ kind });
		});

		it('propagates a plain, unrecognised Error too (not just TailscaleCliError kinds)', async () => {
			cli.logout.mockRejectedValue(new Error('completely unexpected'));

			await expect(service.logout()).rejects.toThrow('completely unexpected');
		});

		it('still cancels a pending interactive login even when the CLI logout call itself fails', async () => {
			const child = new FakeChildProcess();
			cli.spawnUp.mockReturnValue(child);

			const loginPromise = service.login();

			await flushMicrotasks();
			child.stdout.emit(
				'data',
				Buffer.from(
					'{"AuthURL":"https://login.tailscale.com/a/abc","QR":"data:image/png;base64,QQQ","BackendState":"NeedsLogin"}',
				),
			);
			await loginPromise;

			cli.logout.mockRejectedValue(new TailscaleCliError('daemon-down', 'connection refused'));

			await expect(service.logout()).rejects.toBeInstanceOf(TailscaleCliError);

			expect(child.kill).toHaveBeenCalledWith('SIGTERM');
			expect(service.getPendingInteractiveAuth()).toBeNull();
		});
	});

	describe('resetPreferences', () => {
		it('runs up --reset with the full managed flag set and returns the resulting status', async () => {
			nodeManagedService.computeStatus.mockResolvedValue({ state: 'connected' });

			const result = await service.resetPreferences();

			expect(cli.up).toHaveBeenCalledWith(['--reset', '--hostname=panel', '--operator=smart-panel']);
			expect(result).toEqual({ state: 'connected' });
		});

		it('propagates a genuine CLI failure instead of swallowing it', async () => {
			cli.up.mockRejectedValue(new TailscaleCliError('daemon-down', 'connection refused'));

			await expect(service.resetPreferences()).rejects.toMatchObject({ kind: 'daemon-down' });
		});

		it('propagates needs-login too — unlike logout(), there is no "nothing to reset" tolerance', async () => {
			cli.up.mockRejectedValue(new TailscaleCliError('needs-login', 'not logged in'));

			await expect(service.resetPreferences()).rejects.toMatchObject({ kind: 'needs-login' });
		});
	});

	describe('onModuleInit — stale auth-key file cleanup (F4)', () => {
		const authKeyDir = (): string => join(dataDir, TAILSCALE_DATA_SUBDIR);
		let debugSpy: jest.SpyInstance;

		beforeEach(() => {
			debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
		});

		it('removes a stale auth-key file left behind by an abnormal exit', async () => {
			mkdirSync(authKeyDir(), { recursive: true, mode: 0o700 });
			const stalePath = join(authKeyDir(), 'auth-key-11111111-1111-1111-1111-111111111111.key');
			writeFileSync(stalePath, SECRET_AUTH_KEY, { mode: 0o600 });

			await service.onModuleInit();

			expect(existsSync(stalePath)).toBe(false);
		});

		it('removes more than one stale auth-key file in the same directory', async () => {
			mkdirSync(authKeyDir(), { recursive: true, mode: 0o700 });
			const first = join(authKeyDir(), 'auth-key-11111111-1111-1111-1111-111111111111.key');
			const second = join(authKeyDir(), 'auth-key-22222222-2222-2222-2222-222222222222.key');
			writeFileSync(first, SECRET_AUTH_KEY, { mode: 0o600 });
			writeFileSync(second, SECRET_AUTH_KEY, { mode: 0o600 });

			await service.onModuleInit();

			expect(existsSync(first)).toBe(false);
			expect(existsSync(second)).toBe(false);
		});

		it('is a no-op, not a throw, when the data directory does not exist yet (no login has ever been attempted)', async () => {
			await expect(service.onModuleInit()).resolves.toBeUndefined();
		});

		it('leaves an unrelated file in the same directory alone', async () => {
			mkdirSync(authKeyDir(), { recursive: true, mode: 0o700 });
			const unrelatedPath = join(authKeyDir(), 'tailscale-setup-status.json');
			writeFileSync(unrelatedPath, '{"state":"complete"}');

			await service.onModuleInit();

			expect(existsSync(unrelatedPath)).toBe(true);
		});

		it('logs only the file name at debug level, never the key contents', async () => {
			mkdirSync(authKeyDir(), { recursive: true, mode: 0o700 });
			const stalePath = join(authKeyDir(), 'auth-key-11111111-1111-1111-1111-111111111111.key');
			writeFileSync(stalePath, SECRET_AUTH_KEY, { mode: 0o600 });

			await service.onModuleInit();

			expect(debugSpy).toHaveBeenCalledWith(
				expect.stringContaining('auth-key-11111111-1111-1111-1111-111111111111.key'),
				expect.anything(),
			);

			const allDebugCalls = (debugSpy.mock.calls as unknown[][]).flat();

			expect(allDebugCalls.some((arg) => typeof arg === 'string' && arg.includes(SECRET_AUTH_KEY))).toBe(false);
		});
	});
});
