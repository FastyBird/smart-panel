import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
	STUB_GO2RTC_READY_LINE,
	StubGo2rtcMode,
	writeStubGo2rtcScript,
} from '../../../../test/support/stub-go2rtc.script';
import { GO2RTC_OUTPUT_RING_SIZE } from '../cameras.constants';

import { GO2RTC_OVERLONG_LINE_MARKER, Go2rtcExitInfo, Go2rtcProcessService } from './go2rtc-process.service';
import { Go2rtcSecretsRegistry } from './go2rtc-secrets.registry';

/**
 * Exercises real process lifecycle (spawn, SIGTERM/SIGKILL, output capture and redaction) against a `node` stub script
 * standing in for the real `go2rtc` binary. No `child_process` mocking.
 */
describe('Go2rtcProcessService', () => {
	jest.setTimeout(30000);

	const configPath = '/nonexistent/go2rtc.yaml';

	let workDir: string;
	let secrets: Go2rtcSecretsRegistry;
	let service: Go2rtcProcessService;

	async function waitFor(predicate: () => boolean, timeoutMs = 10000): Promise<void> {
		const startedAt = Date.now();

		while (!predicate()) {
			if (Date.now() - startedAt > timeoutMs) {
				throw new Error('waitFor() timed out');
			}

			await new Promise((resolve) => setTimeout(resolve, 20));
		}
	}

	const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

	function startStub(mode: StubGo2rtcMode, onExit: (exit: Go2rtcExitInfo) => void = () => undefined): string {
		const binaryPath = writeStubGo2rtcScript(workDir, mode);

		service.start({ binaryPath, configPath, cwd: workDir }, onExit);

		return binaryPath;
	}

	async function startAndCollect(mode: StubGo2rtcMode, lastLine = STUB_GO2RTC_READY_LINE): Promise<readonly string[]> {
		startStub(mode);

		await waitFor(() => service.getOutputLines().includes(lastLine));

		return service.getOutputLines();
	}

	async function exitOf(mode: StubGo2rtcMode, binaryPath?: string): Promise<Go2rtcExitInfo> {
		return new Promise<Go2rtcExitInfo>((resolve) => {
			if (binaryPath === undefined) {
				startStub(mode, resolve);
			} else {
				service.start({ binaryPath, configPath, cwd: workDir }, resolve);
			}
		});
	}

	function isAlive(pid: number): boolean {
		try {
			process.kill(pid, 0);

			return true;
		} catch {
			return false;
		}
	}

	beforeEach(() => {
		workDir = mkdtempSync(join(tmpdir(), 'go2rtc-process-'));
		secrets = new Go2rtcSecretsRegistry();
		service = new Go2rtcProcessService(secrets);
	});

	afterEach(async () => {
		delete process.env.FB_TEST_LEAK;

		await service.stop(200).catch(() => undefined);

		rmSync(workDir, { recursive: true, force: true });
	});

	it('passes -config and a minimal environment', async () => {
		process.env.FB_TEST_LEAK = 'x';

		const joined = (await startAndCollect('run')).join('\n');

		expect(joined).toContain(`argv=-config ${configPath}`);
		expect(joined).toMatch(/env=[^\n]*PATH/);
		expect(joined).not.toContain('FB_TEST_LEAK');
	});

	it('feeds both stdout and stderr into the ring', async () => {
		const lines = await startAndCollect('run');

		expect(lines.some((line) => line.startsWith('stub argv='))).toBe(true);
		expect(lines.some((line) => line.startsWith('stub env='))).toBe(true);
	});

	it('keeps only the last 64 lines of output', async () => {
		const lines = await startAndCollect('flood', 'line 99');

		expect(lines).toHaveLength(GO2RTC_OUTPUT_RING_SIZE);
		expect(lines[lines.length - 1]).toBe('line 99');
		expect(lines[0]).toBe('line 36');
	});

	it('redacts source urls and registered secrets from the ring', async () => {
		secrets.add('PW_SENTINEL_abcdef0123');

		const joined = (await startAndCollect('run')).join('\n');

		expect(joined).not.toContain('SENTINELALIAS');
		expect(joined).not.toContain('PW_SENTINEL_abcdef0123');
		expect(joined).toContain('rtsps://<redacted>');
		expect(joined).toContain('stub password=<redacted>');
	});

	it('redacts a secret and a url that arrive in two writes with no newline in between', async () => {
		secrets.add('PW_SENTINEL_abcdef0123');

		startStub('split');
		await sleep(100);

		// Only the first halves have been written: they are held back, not stored.
		const early = service.getOutputLines().join('\n');

		expect(early).not.toContain('PW_SENT');
		expect(early).not.toContain('SENTINEL');

		await waitFor(() => service.getOutputLines().includes(STUB_GO2RTC_READY_LINE));

		const lines = service.getOutputLines();
		const joined = lines.join('\n');

		expect(lines).toContain('stub split pw=<redacted>');
		expect(lines).toContain('stub split url=rtsps://<redacted>');
		expect(joined).not.toContain('PW_SENT');
		expect(joined).not.toContain('SENTINEL');
		expect(joined).not.toContain('ALIAS0123456789');
	});

	it('keeps a multibyte character that arrives split across two chunks intact', async () => {
		const lines = await startAndCollect('multibyte');

		expect(lines).toContain('stub multibyte café ok');
		expect(lines.join('\n')).not.toContain('\uFFFD');
	});

	it('stores one marker for an over-long line and drops everything up to its newline', async () => {
		secrets.add('PW_SENTINEL_abcdef0123');

		const lines = await startAndCollect('overlong');
		const joined = lines.join('\n');

		expect(lines.filter((line) => line === GO2RTC_OVERLONG_LINE_MARKER)).toHaveLength(1);
		// Neither the head nor the continuation of the line reaches the ring, only the marker and what follows the newline.
		expect(joined).not.toContain('xxxx');
		expect(joined).not.toContain('stub overlong');
		expect(joined).not.toContain('hunter2pass');
		expect(joined).not.toContain('cam.local');
		expect(joined).not.toContain('PW_SENTINEL_abcdef0123');
		// Other stub lines (stderr) may be stored between the two, so only the order is asserted.
		expect(lines.indexOf('next line ok')).toBeGreaterThan(lines.indexOf(GO2RTC_OVERLONG_LINE_MARKER));
	});

	it('stores and redacts an unterminated tail when the child closes', async () => {
		secrets.add('PW_SENTINEL_abcdef0123');

		const exit = await exitOf('tail');

		expect(exit).toEqual({ code: 0, signal: null, spawnErrorCode: null });
		expect(service.getOutputLines()).toContain('stub tail rtsps://<redacted> pw=<redacted>');
		expect(service.getOutputLines().join('\n')).not.toContain('SENTINELALIAS');
	});

	it('resolves stop() only after the pipes are drained, even when called after exit and before close', async () => {
		secrets.add('PW_SENTINEL_abcdef0123');

		startStub('held-pipes');

		// The child has exited; a helper still holds its stdout, so `close` has not happened.
		await waitFor(() => !service.isRunning());

		expect(service.getPid()).toBeNull();
		expect(service.getOutputLines().join('\n')).not.toContain('late tail');

		let stopped = false;
		const stopping = service.stop().then(() => {
			stopped = true;
		});

		await sleep(150);

		expect(stopped).toBe(false);

		await stopping;

		// The unterminated tail reached the ring, redacted, while the secrets were still registered.
		expect(service.getOutputLines()).toContain('stub late tail rtsps://<redacted> pw=<redacted>');
		expect(service.getOutputLines().join('\n')).not.toContain('SENTINELALIAS');
		expect(service.getOutputLines().join('\n')).not.toContain('PW_SENTINEL_abcdef0123');
	});

	it('does not report a stopped child through onExit when its pipes close after exit', async () => {
		const onExit = jest.fn();

		startStub('held-pipes', onExit);
		await waitFor(() => !service.isRunning());
		await service.stop();
		await sleep(100);

		expect(onExit).not.toHaveBeenCalled();
	});

	it('reports a crash through onExit once, with the output already flushed', async () => {
		secrets.add('PW_SENTINEL_abcdef0123');

		const onExit = jest.fn();
		let ringAtExit: readonly string[] = [];

		startStub('crash', (exit) => {
			ringAtExit = [...service.getOutputLines()];
			onExit(exit);
		});

		await waitFor(() => onExit.mock.calls.length > 0);
		await sleep(150);

		expect(onExit).toHaveBeenCalledTimes(1);
		expect(onExit).toHaveBeenCalledWith({ code: 3, signal: null, spawnErrorCode: null });
		expect(ringAtExit.some((line) => line.startsWith('stub env='))).toBe(true);
		expect(ringAtExit.join('\n')).not.toContain('PW_SENTINEL_abcdef0123');
		expect(service.isRunning()).toBe(false);
		expect(service.getPid()).toBeNull();
	});

	it('reports a missing binary as ENOENT without throwing', async () => {
		let exit: Go2rtcExitInfo | undefined;

		expect(() => {
			void exitOf('run', '/nonexistent/go2rtc').then((value) => (exit = value));
		}).not.toThrow();

		await waitFor(() => exit !== undefined);

		expect(exit).toEqual({ code: null, signal: null, spawnErrorCode: 'ENOENT' });
		expect(service.isRunning()).toBe(false);
	});

	it('does not put the binary path or arguments in the spawn log line', async () => {
		const logSpy = jest.spyOn(service['logger'], 'log');

		await startAndCollect('run');

		expect(logSpy).toHaveBeenCalledTimes(1);
		expect(logSpy.mock.calls[0][0]).toMatch(/^Spawning go2rtc pid=\d+$/);
	});

	it('stops with SIGTERM and does not call onExit for a stopped child', async () => {
		const onExit = jest.fn();

		startStub('run', onExit);
		await waitFor(() => service.getOutputLines().includes(STUB_GO2RTC_READY_LINE));

		const pid = service.getPid();

		expect(pid).not.toBeNull();
		expect(service.isRunning()).toBe(true);

		await service.stop();
		await sleep(150);

		expect(service.isRunning()).toBe(false);
		expect(service.getPid()).toBeNull();
		expect(isAlive(pid)).toBe(false);
		expect(onExit).not.toHaveBeenCalled();
	});

	it('escalates to SIGKILL when SIGTERM is ignored', async () => {
		startStub('ignore-sigterm');
		await waitFor(() => service.getOutputLines().includes(STUB_GO2RTC_READY_LINE));

		const pid = service.getPid();
		const startedAt = Date.now();

		await service.stop(200);

		expect(Date.now() - startedAt).toBeGreaterThanOrEqual(150);
		expect(isAlive(pid)).toBe(false);
		expect(service.isRunning()).toBe(false);
	});

	it('is a no-op when stopped without a child', async () => {
		await expect(service.stop()).resolves.toBeUndefined();
		expect(service.isRunning()).toBe(false);
	});

	it('is idempotent while running', async () => {
		const onExitSecond = jest.fn();
		const binaryPath = startStub('run');

		await waitFor(() => service.getOutputLines().includes(STUB_GO2RTC_READY_LINE));

		const pid = service.getPid();
		const ring = [...service.getOutputLines()];

		service.start({ binaryPath, configPath, cwd: workDir }, onExitSecond);
		await sleep(150);

		expect(service.getPid()).toBe(pid);
		expect(service.getOutputLines()).toEqual(ring);

		await service.stop();
		await sleep(100);

		expect(onExitSecond).not.toHaveBeenCalled();
	});

	it('can be started again after a stop', async () => {
		await startAndCollect('run');

		const firstPid = service.getPid();

		await service.stop();

		expect(service.isRunning()).toBe(false);

		await startAndCollect('run');

		expect(service.isRunning()).toBe(true);
		expect(service.getPid()).not.toBe(firstPid);
		expect(service.getOutputLines().filter((line) => line.startsWith('stub argv='))).toHaveLength(1);
	});
});
