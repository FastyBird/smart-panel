import { type ChildProcess, spawn } from 'node:child_process';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import {
	CAMERAS_MODULE_NAME,
	GO2RTC_OUTPUT_RING_SIZE,
	GO2RTC_STOP_GRACE_MS,
	GO2RTC_STOP_KILL_TIMEOUT_MS,
} from '../cameras.constants';
import { errorName } from '../cameras.exceptions';

import { redactGo2rtcOutput } from './go2rtc-redaction';
import { Go2rtcSecretsRegistry } from './go2rtc-secrets.registry';

/** A line without a newline that grows past this is dropped, so a runaway child cannot grow the carry buffer. */
const MAX_CARRY_LENGTH = 16 * 1024;

/**
 * Stored in place of an over-long line. Redaction cannot match a secret that straddles the cut, so neither half is ever
 * kept: the marker is stored once and the rest of the line, through its newline, is discarded.
 */
export const GO2RTC_OVERLONG_LINE_MARKER = '<output line too long, discarded>';

type CarryKey = 'stdoutCarry' | 'stderrCarry';

export interface Go2rtcProcessOptions {
	binaryPath: string;
	configPath: string;
	cwd: string;
}

export interface Go2rtcExitInfo {
	code: number | null;
	signal: NodeJS.Signals | null;
	/** `error.code` of a failed spawn (for example `ENOENT`); never the error message, which can carry the path. */
	spawnErrorCode: string | null;
}

interface Go2rtcProcessState {
	child: ChildProcess;
	identity: symbol;
	onExit: (exit: Go2rtcExitInfo) => void;
	stdoutCarry: string;
	stderrCarry: string;
	/** An over-long line is being skipped: everything up to the next newline of that stream is dropped. */
	discarding: Record<CarryKey, boolean>;
	/** The child is gone (`exit` seen, or it never started): it no longer counts as running. */
	terminated: boolean;
	/** `stop()` was called: the exit is expected and is not reported through `onExit`. */
	stopping: boolean;
	reported: boolean;
	spawnErrorCode: string | null;
	stopPromise?: Promise<void>;
}

/**
 * Spawns and supervises the `go2rtc` child process (never through a shell). Its stdout and stderr feed one ring of
 * redacted lines; the exit is reported through the callback given to `start`, once per child. Neither the binary path
 * and arguments, nor any output line before redaction, is ever logged.
 */
@Injectable()
export class Go2rtcProcessService {
	private readonly logger = createExtensionLogger(CAMERAS_MODULE_NAME, 'Go2rtcProcessService');

	private processState: Go2rtcProcessState | null = null;
	private latestProcess: Go2rtcProcessState | null = null;
	private ring: string[] = [];

	constructor(private readonly secrets: Go2rtcSecretsRegistry) {}

	isRunning(): boolean {
		return this.processState !== null;
	}

	getPid(): number | null {
		return this.processState?.child.pid ?? null;
	}

	/** The retained output (already redacted), oldest first, at most `GO2RTC_OUTPUT_RING_SIZE` lines. */
	getOutputLines(): readonly string[] {
		return this.ring;
	}

	/** No-op while a child is running. Never throws: a failed spawn is reported through `onExit`. */
	start(options: Go2rtcProcessOptions, onExit: (exit: Go2rtcExitInfo) => void): void {
		if (this.processState) {
			return;
		}

		this.ring = [];

		let child: ChildProcess;

		try {
			child = spawn(options.binaryPath, ['-config', options.configPath], {
				cwd: options.cwd,
				env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' },
				stdio: ['ignore', 'pipe', 'pipe'],
			});
		} catch (error) {
			this.logger.warn(`go2rtc spawn failed code=${errorCode(error)}`);
			this.reportSpawnFailure(onExit, errorCode(error));

			return;
		}

		const state: Go2rtcProcessState = {
			child,
			identity: Symbol(),
			onExit,
			stdoutCarry: '',
			stderrCarry: '',
			discarding: { stdoutCarry: false, stderrCarry: false },
			terminated: false,
			stopping: false,
			reported: false,
			spawnErrorCode: null,
		};

		this.processState = state;
		this.latestProcess = state;

		if (child.pid !== undefined) {
			this.logger.log(`Spawning go2rtc pid=${child.pid}`);
		}

		const onStdout = (chunk: Buffer): void => this.append(state, 'stdoutCarry', chunk.toString('utf8'));
		const onStderr = (chunk: Buffer): void => this.append(state, 'stderrCarry', chunk.toString('utf8'));
		const onChildExit = (): void => this.markTerminated(state);
		const onError = (error: Error): void => {
			const code = errorCode(error);

			if (child.pid === undefined) {
				state.spawnErrorCode = code;
				this.logger.warn(`go2rtc spawn failed code=${code}`);
				this.markTerminated(state);
				this.report(state, { code: null, signal: null, spawnErrorCode: code });
				this.detach(state, onStdout, onStderr, onChildExit, onError, onClose);

				return;
			}

			// A runtime error (for example a failed signal) does not prove the child exited.
			this.logger.warn(`go2rtc process error code=${code}`);
		};
		const onClose = (code: number | null, signal: NodeJS.Signals | null): void => {
			this.markTerminated(state);
			this.flush(state);
			this.report(state, { code, signal, spawnErrorCode: state.spawnErrorCode });
			this.detach(state, onStdout, onStderr, onChildExit, onError, onClose);
		};

		child.stdout?.on('data', onStdout);
		child.stderr?.on('data', onStderr);
		child.once('exit', onChildExit);
		child.on('error', onError);
		child.once('close', onClose);
	}

	/**
	 * SIGTERM, then SIGKILL after `graceMs`. Rejects after a bounded wait if the exit cannot be confirmed; ownership is
	 * then retained so a second process is never started alongside it. `onExit` is not called for a stopped child.
	 */
	async stop(graceMs: number = GO2RTC_STOP_GRACE_MS): Promise<void> {
		const state = this.processState;

		if (!state) {
			return;
		}

		if (state.stopPromise !== undefined) {
			return state.stopPromise;
		}

		state.stopping = true;

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
					reject(new Error('go2rtc termination could not be confirmed after SIGKILL'));
				}, GO2RTC_STOP_KILL_TIMEOUT_MS);
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

	private markTerminated(state: Go2rtcProcessState): void {
		state.terminated = true;

		if (this.processState === state) {
			this.processState = null;
		}
	}

	/** Delivers the exit once per child; a stopped child is not reported. */
	private report(state: Go2rtcProcessState, exit: Go2rtcExitInfo): void {
		if (state.reported) {
			return;
		}

		state.reported = true;

		if (state.stopping) {
			return;
		}

		this.invoke(state.onExit, exit);
	}

	private reportSpawnFailure(onExit: (exit: Go2rtcExitInfo) => void, spawnErrorCode: string): void {
		// Never synchronously: the caller of `start` has not returned yet.
		process.nextTick(() => this.invoke(onExit, { code: null, signal: null, spawnErrorCode }));
	}

	private invoke(onExit: (exit: Go2rtcExitInfo) => void, exit: Go2rtcExitInfo): void {
		try {
			onExit(exit);
		} catch (error) {
			this.logger.warn(`go2rtc exit callback failed error=${errorName(error)}`);
		}
	}

	private detach(
		state: Go2rtcProcessState,
		onStdout: (chunk: Buffer) => void,
		onStderr: (chunk: Buffer) => void,
		onExit: () => void,
		onError: (error: Error) => void,
		onClose: (code: number | null, signal: NodeJS.Signals | null) => void,
	): void {
		const { child } = state;

		child.stdout?.removeListener('data', onStdout);
		child.stderr?.removeListener('data', onStderr);
		child.removeListener('exit', onExit);
		child.removeListener('close', onClose);

		// Keep an error listener: a late error event with no listener would be thrown as an uncaught exception.
		child.removeListener('error', onError);
		child.on('error', () => undefined);
	}

	private append(state: Go2rtcProcessState, carryKey: CarryKey, text: string): void {
		if (this.latestProcess !== state) {
			return;
		}

		let incoming = text;

		if (state.discarding[carryKey]) {
			const newline = incoming.indexOf('\n');

			if (newline === -1) {
				return;
			}

			state.discarding[carryKey] = false;
			incoming = incoming.slice(newline + 1);
		}

		state[carryKey] += incoming;

		const lines = state[carryKey].split('\n');

		state[carryKey] = lines.pop() ?? '';

		for (const line of lines) {
			this.store(line.endsWith('\r') ? line.slice(0, -1) : line);
		}

		if (state[carryKey].length > MAX_CARRY_LENGTH) {
			this.store(GO2RTC_OVERLONG_LINE_MARKER);
			state[carryKey] = '';
			state.discarding[carryKey] = true;
		}
	}

	/** Stores the unterminated tail of each stream once the child is gone. */
	private flush(state: Go2rtcProcessState): void {
		if (this.latestProcess !== state) {
			return;
		}

		for (const carryKey of ['stdoutCarry', 'stderrCarry'] as const) {
			if (state[carryKey] !== '') {
				this.store(state[carryKey]);
				state[carryKey] = '';
			}
		}
	}

	private store(line: string): void {
		this.ring.push(redactGo2rtcOutput(line, this.secrets.list()));

		if (this.ring.length > GO2RTC_OUTPUT_RING_SIZE) {
			this.ring.shift();
		}
	}
}

function errorCode(error: unknown): string {
	const code = (error as NodeJS.ErrnoException | undefined)?.code;

	return typeof code === 'string' && /^[A-Z0-9_]{1,40}$/.test(code) ? code : 'UNKNOWN';
}
