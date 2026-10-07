import { type ChildProcess, spawn } from 'node:child_process';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import {
	CLOUDFLARED_BINARY,
	CLOUDFLARED_STDERR_RING_SIZE,
	CLOUDFLARED_STOP_GRACE_MS,
	CLOUDFLARED_STOP_KILL_TIMEOUT_MS,
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

interface CloudflaredProcessState {
	child: ChildProcess;
	identity: symbol;
	token: string;
	stderrCarry: string;
	terminated: boolean;
	stopPromise?: Promise<void>;
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

	private processState: CloudflaredProcessState | null = null;
	private latestProcess: CloudflaredProcessState | null = null;
	private startedAt: number | null = null;
	private stderrRing: string[] = [];
	private lastExit: CloudflaredExitInfo | null = null;

	isRunning(): boolean {
		return this.processState !== null;
	}

	/** Opaque identity of the owned child, distinct even for spawns in the same millisecond. */
	getProcessIdentity(): symbol | null {
		return this.processState?.identity ?? null;
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
		if (this.processState) {
			return;
		}

		this.stderrRing = [];
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

		const state: CloudflaredProcessState = {
			child,
			identity: Symbol(),
			token: options.token,
			stderrCarry: '',
			terminated: false,
		};

		this.processState = state;
		this.latestProcess = state;
		this.startedAt = Date.now();

		const onData = (chunk: Buffer): void => this.appendStderr(state, chunk.toString('utf8'));
		const onExit = (code: number | null, signal: NodeJS.Signals | null): void => {
			this.markTerminated(state, { code, signal });
		};
		const onError = (error: Error): void => {
			this.appendStderr(state, `${error.message}\n`);

			if (this.latestProcess === state) {
				this.logger.warn(`cloudflared process error: ${this.redact(state, error.message)}`);
			}

			// A failed spawn has no PID. Runtime errors (including failed signals) do not prove exit.
			if (child.pid === undefined) {
				this.markTerminated(state, { code: null, signal: null });
			}
		};
		const onClose = (code: number | null, signal: NodeJS.Signals | null): void => {
			this.markTerminated(state, { code, signal });

			if (state.stderrCarry) {
				this.appendStderr(state, '\n');
			}

			child.stderr?.removeListener('data', onData);
			child.removeListener('exit', onExit);
			child.removeListener('error', onError);
			child.removeListener('close', onClose);
		};

		child.stderr?.on('data', onData);
		child.once('exit', onExit);
		child.on('error', onError);
		child.once('close', onClose);
	}

	/**
	 * SIGTERM, then SIGKILL after `graceMs`. Rejects after a bounded wait if termination
	 * cannot be confirmed, retaining ownership so another process cannot be started alongside it.
	 */
	async stop(graceMs: number = CLOUDFLARED_STOP_GRACE_MS): Promise<void> {
		const state = this.processState;

		if (!state) {
			return;
		}

		if (state.stopPromise !== undefined) {
			return state.stopPromise;
		}

		const { child } = state;
		const stopPromise = new Promise<void>((resolve, reject) => {
			let timer: ReturnType<typeof setTimeout>;
			const cleanup = (): void => {
				clearTimeout(timer);
				child.removeListener('exit', onTerminated);
				child.removeListener('close', onTerminated);
				child.removeListener('error', onError);
			};
			const onTerminated = (): void => {
				cleanup();
				resolve();
			};
			const onError = (): void => {
				if (state.terminated) {
					onTerminated();
				}
			};
			const signal = (name: NodeJS.Signals): void => {
				try {
					child.kill(name);
				} catch {
					// A failed signal does not prove exit. Keep waiting for exit/close or the bound.
				}
			};

			child.once('exit', onTerminated);
			child.once('close', onTerminated);
			child.on('error', onError);
			timer = setTimeout(() => {
				timer = setTimeout(() => {
					cleanup();
					reject(new Error('cloudflared termination could not be confirmed after SIGKILL'));
				}, CLOUDFLARED_STOP_KILL_TIMEOUT_MS);
				timer.unref?.();
				signal('SIGKILL');
			}, graceMs);
			timer.unref?.();
			signal('SIGTERM');
		});

		state.stopPromise = stopPromise;

		try {
			await stopPromise;
		} finally {
			state.stopPromise = undefined;
		}
	}

	private markTerminated(state: CloudflaredProcessState, exit: CloudflaredExitInfo): void {
		if (state.terminated) {
			return;
		}

		state.terminated = true;

		if (this.processState === state) {
			this.lastExit = exit;
			this.processState = null;
			this.startedAt = null;
		}
	}

	private appendStderr(state: CloudflaredProcessState, text: string): void {
		if (this.latestProcess !== state) {
			return;
		}

		state.stderrCarry += text;

		const lines = state.stderrCarry.split('\n');

		state.stderrCarry = lines.pop() ?? '';

		for (const rawLine of lines) {
			this.stderrRing.push(this.redact(state, rawLine));

			if (this.stderrRing.length > CLOUDFLARED_STDERR_RING_SIZE) {
				this.stderrRing.shift();
			}
		}
	}

	/** Replaces every occurrence of the child’s tunnel token with a placeholder — the token must never reach a log line, error message or stderr excerpt. */
	private redact(state: CloudflaredProcessState, line: string): string {
		if (!state.token) {
			return line;
		}

		return line.split(state.token).join('***redacted***');
	}
}
