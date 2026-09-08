import { type ChildProcess, spawn } from 'node:child_process';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import {
	CLOUDFLARED_BINARY,
	CLOUDFLARED_STDERR_RING_SIZE,
	CLOUDFLARED_STOP_GRACE_MS,
	REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
} from '../remote-access-cloudflare-tunnel.constants';

export interface CloudflaredProcessOptions {
	/** Never placed on argv or logged — passed only through the child's `TUNNEL_TOKEN` env var. */
	token: string;
	protocol: string;
	/** `host:port` the `--metrics` flag binds to. */
	metricsAddress: string;
}

export interface CloudflaredExitInfo {
	code: number | null;
	signal: NodeJS.Signals | null;
}

/**
 * Spawns and supervises `cloudflared tunnel ... run` as a child process of the backend (D9) —
 * never through `cloudflared service install`/systemd. The token is handed to the child only
 * through the `TUNNEL_TOKEN` environment variable (never argv, never logged) and is redacted
 * from every captured stderr line before it is retained in the ring buffer this service exposes.
 */
@Injectable()
export class CloudflaredProcessService {
	private readonly logger = createExtensionLogger(
		REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
		'CloudflaredProcessService',
	);

	private child: ChildProcess | null = null;
	private startedAt: number | null = null;
	private currentToken = '';
	private stderrRing: string[] = [];
	private stderrCarry = '';
	private lastExit: CloudflaredExitInfo | null = null;

	isRunning(): boolean {
		return this.child !== null;
	}

	/** `Date.now()` timestamp of the current spawn, or `null` while not running. */
	getStartedAt(): number | null {
		return this.startedAt;
	}

	/** `{ code, signal }` of the most recent exit, or `null` if the process has never exited since this service was created. */
	getLastExit(): CloudflaredExitInfo | null {
		return this.lastExit;
	}

	/** Most recent captured (and redacted) stderr line, or `null` if none has arrived yet. */
	getLastStderrLine(): string | null {
		for (let i = this.stderrRing.length - 1; i >= 0; i--) {
			if (this.stderrRing[i].length > 0) {
				return this.stderrRing[i];
			}
		}

		return null;
	}

	/** The full retained ring buffer (already redacted), oldest first — for tests and diagnostics. */
	getStderrLines(): readonly string[] {
		return this.stderrRing;
	}

	/** Idempotent — a call while already running is a no-op, matching the managed service's own tolerant `start()` pattern. */
	start(options: CloudflaredProcessOptions): void {
		if (this.child) {
			return;
		}

		this.currentToken = options.token;
		this.stderrRing = [];
		this.stderrCarry = '';
		this.lastExit = null;

		const args = [
			'tunnel',
			'--no-autoupdate',
			'--metrics',
			options.metricsAddress,
			'--protocol',
			options.protocol,
			'run',
		];

		this.logger.log(`Spawning: ${CLOUDFLARED_BINARY} ${args.join(' ')}`);

		const child = spawn(CLOUDFLARED_BINARY, args, {
			env: {
				TUNNEL_TOKEN: options.token,
				HOME: process.env.HOME ?? '',
				PATH: process.env.PATH ?? '',
			},
			stdio: ['ignore', 'pipe', 'pipe'],
		});

		this.child = child;
		this.startedAt = Date.now();

		child.stderr?.on('data', (chunk: Buffer) => {
			this.appendStderr(chunk.toString('utf8'));
		});

		child.once('exit', (code, signal) => {
			this.lastExit = { code, signal };
			this.child = null;
			this.startedAt = null;
		});

		child.once('error', (error) => {
			this.appendStderr(`${error.message}\n`);
			this.lastExit = { code: null, signal: null };
			this.child = null;
			this.startedAt = null;

			this.logger.warn(`cloudflared failed to spawn: ${error.message}`);
		});
	}

	/**
	 * SIGTERM, then SIGKILL after `graceMs` (default {@link CLOUDFLARED_STOP_GRACE_MS}) if the
	 * process has not exited by then. Resolves once the process has actually exited (via either
	 * path) — a no-op when nothing is running.
	 */
	async stop(graceMs: number = CLOUDFLARED_STOP_GRACE_MS): Promise<void> {
		const child = this.child;

		if (!child) {
			return;
		}

		await new Promise<void>((resolve) => {
			const timer = setTimeout(() => {
				try {
					child.kill('SIGKILL');
				} catch {
					// Already gone.
				}
			}, graceMs);

			timer.unref?.();

			child.once('exit', () => {
				clearTimeout(timer);
				resolve();
			});

			try {
				child.kill('SIGTERM');
			} catch {
				clearTimeout(timer);
				resolve();
			}
		});

		this.child = null;
		this.startedAt = null;
	}

	private appendStderr(text: string): void {
		this.stderrCarry += text;

		const lines = this.stderrCarry.split('\n');

		this.stderrCarry = lines.pop() ?? '';

		for (const rawLine of lines) {
			this.stderrRing.push(this.redact(rawLine));

			if (this.stderrRing.length > CLOUDFLARED_STDERR_RING_SIZE) {
				this.stderrRing.shift();
			}
		}
	}

	/** Replaces every occurrence of the current tunnel token with a placeholder — the token must never reach a log line, error message or stderr excerpt. */
	private redact(line: string): string {
		if (!this.currentToken) {
			return line;
		}

		return line.split(this.currentToken).join('***redacted***');
	}
}
