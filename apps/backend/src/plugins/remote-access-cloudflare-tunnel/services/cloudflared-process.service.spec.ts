import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { CloudflaredProcessService } from './cloudflared-process.service';

/**
 * Exercises real process lifecycle (spawn, SIGTERM/SIGKILL, stderr capture and redaction)
 * against a small `node`-based stub script standing in for the real `cloudflared` binary —
 * the same PATH-shadowing technique `tailscale-setup.sh.spec.ts` uses to fake `curl`. No
 * `child_process` mocking: this genuinely spawns a process and genuinely kills it.
 */
describe('CloudflaredProcessService', () => {
	jest.setTimeout(30000);

	const TOKEN = 'super-secret-tunnel-token-value';

	let workDir: string;
	let fakeBinDir: string;
	let originalPath: string | undefined;
	let service: CloudflaredProcessService;

	function writeFakeCloudflared(mode: 'run' | 'crash' | 'ignore-sigterm'): void {
		const script = [
			'#!/usr/bin/env node',
			"'use strict';",
			`const mode = ${JSON.stringify(mode)};`,
			'const token = process.env.TUNNEL_TOKEN || "";',
			'process.stderr.write(`fake-cloudflared starting, argv=${process.argv.slice(2).join(" ")}\\n`);',
			'process.stderr.write(`token seen: ${token}\\n`);',
			'if (mode === "crash") {',
			'  process.stderr.write("fatal error: simulated crash\\n");',
			'  process.exit(1);',
			'}',
			'if (mode === "ignore-sigterm") {',
			'  process.on("SIGTERM", () => { process.stderr.write("SIGTERM ignored\\n"); });',
			'}',
			'setInterval(() => {}, 60000);',
			'',
		].join('\n');

		writeFileSync(join(fakeBinDir, 'cloudflared'), script);
		chmodSync(join(fakeBinDir, 'cloudflared'), 0o755);
	}

	/**
	 * Polls a real (unfaked) condition for up to `timeoutMs`, since these are genuine
	 * child-process events, not timers. The default is generous (well beyond how long spawning
	 * and observing a trivial Node stub script actually takes) because this genuinely spawns an
	 * OS process, and CI/parallel-worker contention can slow that down noticeably.
	 */
	async function waitFor(predicate: () => boolean, timeoutMs = 8000): Promise<void> {
		const start = Date.now();

		while (!predicate()) {
			if (Date.now() - start > timeoutMs) {
				throw new Error('waitFor() timed out');
			}

			await new Promise((resolve) => setTimeout(resolve, 20));
		}
	}

	beforeEach(() => {
		workDir = mkdtempSync(join(tmpdir(), 'ra13-cloudflared-'));
		fakeBinDir = join(workDir, 'bin');
		mkdirSync(fakeBinDir);

		originalPath = process.env.PATH;
		process.env.PATH = `${fakeBinDir}:${originalPath ?? ''}`;

		service = new CloudflaredProcessService();
	});

	afterEach(async () => {
		await service.stop(50);

		if (originalPath !== undefined) {
			process.env.PATH = originalPath;
		}

		rmSync(workDir, { recursive: true, force: true });
	});

	it('is not running before start() is called', () => {
		expect(service.isRunning()).toBe(false);
		expect(service.getStartedAt()).toBeNull();
	});

	it('spawns the process and reports it running', async () => {
		writeFakeCloudflared('run');

		service.start({ token: TOKEN, protocol: 'auto', metricsAddress: '127.0.0.1:20246' });

		await waitFor(() => service.isRunning());

		expect(service.isRunning()).toBe(true);
		expect(service.getStartedAt()).not.toBeNull();
	});

	it('is idempotent — a second start() call while already running does not respawn', async () => {
		writeFakeCloudflared('run');

		service.start({ token: TOKEN, protocol: 'auto', metricsAddress: '127.0.0.1:20246' });
		await waitFor(() => service.isRunning());

		const startedAt = service.getStartedAt();

		service.start({ token: 'a-different-token', protocol: 'quic', metricsAddress: '127.0.0.1:20246' });

		expect(service.getStartedAt()).toBe(startedAt);
	});

	it('never leaks the token into any captured stderr line, log message or error text', async () => {
		writeFakeCloudflared('run');

		service.start({ token: TOKEN, protocol: 'auto', metricsAddress: '127.0.0.1:20246' });

		await waitFor(() => service.getStderrLines().length > 0);
		// Give the "token seen: ..." line a moment to arrive too (both stderr.write calls land
		// in short order, but are not guaranteed to be flushed as of the first waitFor tick).
		await waitFor(() => service.getStderrLines().some((line) => line.includes('token seen:')));

		const allCapturedText = service.getStderrLines().join('\n');

		expect(allCapturedText).not.toContain(TOKEN);
		expect(allCapturedText).toContain('***redacted***');
	});

	it('stops the process with a plain SIGTERM when it exits promptly', async () => {
		writeFakeCloudflared('run');

		service.start({ token: TOKEN, protocol: 'auto', metricsAddress: '127.0.0.1:20246' });
		await waitFor(() => service.isRunning());

		await service.stop(2000);

		expect(service.isRunning()).toBe(false);
		expect(service.getStartedAt()).toBeNull();
	});

	it('escalates to SIGKILL after the grace period when the process ignores SIGTERM', async () => {
		writeFakeCloudflared('ignore-sigterm');

		service.start({ token: TOKEN, protocol: 'auto', metricsAddress: '127.0.0.1:20246' });
		await waitFor(() => service.isRunning());

		const startedAt = Date.now();

		await service.stop(100);

		expect(service.isRunning()).toBe(false);
		// Proves SIGKILL actually fired: the process ignores SIGTERM outright, so exit could only
		// happen once the grace timer escalated — bounded well under the real 10s production grace.
		expect(Date.now() - startedAt).toBeLessThan(5000);
	});

	it('stop() is a no-op when nothing is running', async () => {
		await expect(service.stop(50)).resolves.toBeUndefined();
	});

	it('captures the exit code and the last (redacted) stderr line when the process crashes unexpectedly', async () => {
		writeFakeCloudflared('crash');

		service.start({ token: TOKEN, protocol: 'auto', metricsAddress: '127.0.0.1:20246' });

		await waitFor(() => service.getLastExit() !== null);

		expect(service.isRunning()).toBe(false);
		expect(service.getLastExit()).toMatchObject({ code: 1 });
		expect(service.getLastStderrLine()).toContain('simulated crash');
	});

	it('resets the stderr ring buffer and exit info on a fresh start()', async () => {
		writeFakeCloudflared('crash');

		service.start({ token: TOKEN, protocol: 'auto', metricsAddress: '127.0.0.1:20246' });
		await waitFor(() => service.getLastExit() !== null);

		writeFakeCloudflared('run');

		service.start({ token: TOKEN, protocol: 'auto', metricsAddress: '127.0.0.1:20246' });
		await waitFor(() => service.isRunning());

		expect(service.getLastExit()).toBeNull();
	});
});
