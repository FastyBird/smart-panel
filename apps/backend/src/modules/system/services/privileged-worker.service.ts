import { existsSync, readFileSync } from 'fs';
import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { PlatformService } from '../../platform/services/platform.service';
import { SYSTEM_MODULE_NAME } from '../system.constants';
import { PrivilegedWorkerUnavailableException } from '../system.exceptions';

export interface PrivilegedJobSpec {
	unit: string;
	script: string;
	args: string[];
	env?: Record<string, string>;
	statusFile: string;
	timeoutMs?: number;
	/**
	 * Maps a raw, caller-defined status-file JSON shape onto the generic PrivilegedJobStatus
	 * fields this service understands, applied before the service's own terminal-state
	 * detection. Omit when the script already writes the canonical `{ state, step, message }`
	 * shape directly. Only `state`, `step` and `message` are read from the return value — `id`
	 * and `updatedAt` are always service-owned (see PrivilegedJobStatus) even if present here.
	 * `state: 'timeout'` is rejected — that value is reserved for the service itself.
	 * Return `null` to signal "not a valid status yet" (e.g. the file is mid-write) — the tick
	 * is skipped and retried next cycle, exactly like a JSON parse failure, a missing/
	 * unrecognized `state`, or the mapper itself throwing.
	 */
	mapStatus?: (raw: Record<string, unknown>) => Partial<PrivilegedJobStatus> | null;
	/**
	 * Applied per-line to the captured stderr (see `PrivilegedJobStatus.stderr`) before it is
	 * exposed on any status this service produces — e.g. to strip a secret a script might echo
	 * by accident. The raw, unredacted buffer this service accumulates internally is never
	 * itself exposed. Omit when the child's stderr carries nothing sensitive.
	 */
	redact?: (line: string) => string;
}

export interface PrivilegedJobStatus {
	/** Always the job id this service generated in `run()` — never read from the status file. */
	id: string;
	/**
	 * Validated against `'running' | 'complete' | 'failed' | 'timeout'`. A native script (or a
	 * `mapStatus` result) with a missing or unrecognized `state` is treated as no status at all
	 * — the tick is ignored and the previous status stands. `'timeout'` is reserved: only this
	 * service ever produces it, after the job's hard timeout elapses — a file/mapper tick
	 * claiming `'timeout'` is rejected the same way as a missing/unrecognized state.
	 */
	state: 'running' | 'complete' | 'failed' | 'timeout';
	/** Free-form, caller-defined. Non-string values from the file/mapper are dropped. */
	step?: string;
	/** Free-form, caller-defined. Non-string values from the file/mapper are dropped. */
	message?: string;
	/**
	 * The first 4 KiB of the child's stderr captured so far, redacted through `spec.redact` (when
	 * given). Always service-owned, accumulated from the spawned process's own `stderr` stream —
	 * never read from the status file. `undefined` until at least one byte of stderr has arrived.
	 */
	stderr?: string;
	/** Always set by the service when it accepts a status tick — never read from the file. */
	updatedAt: string;
}

type StatusHandler = (status: PrivilegedJobStatus) => void;

interface JobRecord {
	id: string;
	unit: string;
	statusFile: string;
	timeoutMs: number;
	startedAt: number;
	pollTimer: NodeJS.Timeout | null;
	lastStatus: PrivilegedJobStatus;
	handlers: Set<StatusHandler>;
	mapStatus?: PrivilegedJobSpec['mapStatus'];
	redact?: PrivilegedJobSpec['redact'];
	/** Accumulates the child's stderr, capped at STDERR_CAPTURE_LIMIT_BYTES — see getCapturedStderr(). */
	stderrBuffer: Buffer;
	/** True once an unusable tick (missing/invalid state, or mapStatus returning null) has been
	 *  logged for this job — caps the debug log at one per job instead of one per bad tick. */
	loggedInvalidStatus: boolean;
	/**
	 * Non-null from the moment this job's unit is actually freed (see `stopPolling`) until
	 * `PRUNE_AFTER_MS` elapses, at which point the record is dropped from `jobs` (see
	 * `schedulePrune`). Never set while the job is still running or still occupying its unit — a
	 * job kept reserved in `busyUnits` past its terminal state (the "still running after a stop
	 * attempt" case in `handleTimeout`) never reaches the branch that sets this. Unref'd like every
	 * other timer in this file so a pending prune can never keep the process alive.
	 */
	pruneTimer: NodeJS.Timeout | null;
}

const STATUS_POLL_INTERVAL_MS = 3_000; // Poll worker status every 3 seconds
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/** Caps how much of a failed job's stderr is retained/exposed — enough for a useful diagnostic (e.g. sudo's own refusal reason) without holding an unbounded buffer for a chatty script. */
const STDERR_CAPTURE_LIMIT_BYTES = 4 * 1024;

/** Bounds the unprivileged `systemctl is-active` read `handleTimeout` uses to confirm a stop attempt — same probe pattern/budget as TailscaleNodeManagedService's own systemd unit check. */
const IS_ACTIVE_PROBE_TIMEOUT_MS = 2_000;
/** Bounds the privileged stop attempt `handleTimeout` makes, so a scope that refuses to stop cannot strand the job in 'running'. */
const STOP_ATTEMPT_TIMEOUT_MS = 15_000;

/**
 * How long a job's record is kept in `jobs` after its unit is actually freed (see `stopPolling`)
 * before being pruned — bounds the map to recently-finished jobs instead of retaining every job
 * (including its handler set) for the life of the process (see issue #949). Implemented as a
 * single unref'd `setTimeout` scheduled once, at the moment the unit is released — not a periodic
 * sweep — so a job kept reserved past its terminal state is naturally never scheduled at all.
 */
const PRUNE_AFTER_MS = 5 * 60_000; // 5 minutes

// 'timeout' is deliberately excluded — it is reserved for this service's own hard-timeout path
// (see the top of startPolling's tick below). A file/mapper tick claiming it is invalid, same as
// a missing or unrecognized state.
const VALID_TICK_STATES: ReadonlySet<string> = new Set(['running', 'complete', 'failed']);

function isValidTickState(value: unknown): value is Exclude<PrivilegedJobStatus['state'], 'timeout'> {
	return typeof value === 'string' && VALID_TICK_STATES.has(value);
}

function toOptionalString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

/**
 * Runs a script as a detached, root-owned systemd scope via `sudo -n systemd-run` and tracks its
 * progress through a JSON status file the script writes itself.
 *
 * Extracted from UpdateExecutorService so any privileged, long-running operation (OS update,
 * Tailscale setup, ...) can reuse the same spawn / poll / timeout / one-job-per-unit machinery
 * instead of re-implementing it. The service owns the whole job lifecycle: a unit is reserved by
 * `run()` and released only when the job reaches a terminal state (`complete`, `failed` or
 * `timeout`), the spawned process fails to launch (a synchronous `spawn` throw or the child's
 * `error` event) or exits with a failure before reporting completion — never merely because the
 * last `onStatus` subscriber unsubscribed.
 *
 * The service also owns `id` and `updatedAt` on every PrivilegedJobStatus it produces, and
 * validates `state` — see the field docs on PrivilegedJobStatus. A native script only ever needs
 * to write `{ state, step?, message? }`; a caller with a different status-file shape supplies
 * `mapStatus` to produce the same three fields before this service's own terminal-state
 * detection and validation run.
 *
 * A job's record (including its handler set) is not kept for the life of the process once it is
 * done: `PRUNE_AFTER_MS` after its unit is actually freed, the record is dropped from `jobs` and
 * `getStatus(id)` starts returning `null`, matching its existing behavior for an unknown id — see
 * `schedulePrune`. A job kept reserved past its terminal state (the "still running after a stop
 * attempt" case in `handleTimeout`) is never pruned while it still occupies its unit.
 */
@Injectable()
export class PrivilegedWorkerService {
	private readonly logger = createExtensionLogger(SYSTEM_MODULE_NAME, 'PrivilegedWorkerService');

	private readonly jobs = new Map<string, JobRecord>();
	private readonly busyUnits = new Map<string, string>(); // unit -> job id

	constructor(private readonly platformService: PlatformService) {}

	async run(spec: PrivilegedJobSpec): Promise<{ id: string }> {
		const supported = await this.platformService.supportsPrivilegedWorkers();

		if (!supported) {
			throw new PrivilegedWorkerUnavailableException(
				`Privileged workers are not supported on this platform (${this.platformService.getPlatformType()}).`,
			);
		}

		if (this.busyUnits.has(spec.unit)) {
			const busyJobId = this.busyUnits.get(spec.unit);
			const busyRecord = busyJobId ? this.jobs.get(busyJobId) : undefined;

			// The only way a unit stays in busyUnits with a 'timeout' lastStatus is the "still
			// running after a timeout stop attempt" path in handleTimeout below — every other
			// terminal path frees the unit via stopPolling. Called out explicitly so an operator
			// reading this doesn't mistake it for an ordinary busy-unit rejection.
			if (busyRecord?.lastStatus.state === 'timeout') {
				throw new PrivilegedWorkerUnavailableException(
					`Privileged worker unit "${spec.unit}" timed out previously and is still running after a stop attempt; it cannot be reused until the process is confirmed stopped.`,
				);
			}

			throw new PrivilegedWorkerUnavailableException(`Privileged worker unit "${spec.unit}" is already busy.`);
		}

		const id = randomUUID();
		const timeoutMs = spec.timeoutMs ?? DEFAULT_TIMEOUT_MS;

		const record: JobRecord = {
			id,
			unit: spec.unit,
			statusFile: spec.statusFile,
			timeoutMs,
			startedAt: Date.now(),
			pollTimer: null,
			lastStatus: { id, state: 'running', updatedAt: new Date().toISOString() },
			handlers: new Set(),
			mapStatus: spec.mapStatus,
			redact: spec.redact,
			stderrBuffer: Buffer.alloc(0),
			loggedInvalidStatus: false,
			pruneTimer: null,
		};

		// Reserve the unit before spawning so a caller can never slip a second job in
		// between the platform check above and the spawn call below.
		this.jobs.set(id, record);
		this.busyUnits.set(spec.unit, id);

		try {
			const setenvArgs = Object.entries(spec.env ?? {}).flatMap(([key, value]) => ['--setenv', `${key}=${value}`]);

			const child = spawn(
				'sudo',
				['-n', 'systemd-run', '--scope', `--unit=${spec.unit}`, ...setenvArgs, 'bash', spec.script, ...spec.args],
				// stderr is piped (not ignored) so a refusal sudo/systemd-run itself only ever
				// reports on stderr — e.g. "sudo: a password is required" — reaches the admin
				// instead of a bare "Worker process exited with code 1". stdin/stdout stay
				// ignored: nothing here ever reads them.
				{ detached: true, stdio: ['ignore', 'ignore', 'pipe'] },
			);

			// The child is detached + unref'd below so it can outlive this process; an actively
			// read pipe would otherwise keep this process's event loop alive on its own (a
			// separate handle from the child itself), defeating that. `@types/node` types
			// `child.stderr` as a plain `Readable`, but a piped child stdio stream is backed by a
			// handle that does implement `unref()` at runtime — hence the cast.
			(child.stderr as unknown as { unref?: () => void } | null)?.unref?.();

			child.stderr?.on('data', (chunk: Buffer) => {
				if (record.stderrBuffer.length >= STDERR_CAPTURE_LIMIT_BYTES) {
					return;
				}

				record.stderrBuffer = Buffer.concat([record.stderrBuffer, chunk]).subarray(0, STDERR_CAPTURE_LIMIT_BYTES);
			});

			// Detached + unref'd, so a crash of this process's own error handling must not
			// crash the process — sudo/systemd-run missing is a config error, not a fatal one.
			// Guarded the same way as 'exit' below: a stale/late 'error' after the job already
			// went terminal (via the status file, or the 'exit' handler) must not re-fire it.
			child.on('error', (error) => {
				if (record.lastStatus.state !== 'running') {
					return;
				}

				const stderr = this.getCapturedStderr(record);

				this.logger.error(
					`Privileged worker unit "${spec.unit}" failed to spawn: ${error.message}${stderr ? ` (${stderr})` : ''}`,
				);

				this.finishJob(record, {
					id,
					state: 'failed',
					message: this.buildFailureMessage(error.message, stderr),
					stderr,
					updatedAt: new Date().toISOString(),
				});
			});

			// `systemd-run --scope` runs its command in the foreground, so this `sudo` process
			// stays alive for the whole job and exits with its result. A non-zero exit (or a
			// signal) before any status file ever reported completion means the job failed
			// without writing one — e.g. sudo/systemd-run itself rejected the invocation, or the
			// script errored before its first status write. Guarded on `lastStatus.state` still
			// being 'running' so this can never override a result already read from the status
			// file (or a job that keeps running detached after this scope process exits, which a
			// zero exit doesn't tell us anything about either way — the status file stays the
			// source of truth for that case).
			child.on('exit', (code, signal) => {
				if (record.lastStatus.state !== 'running') {
					return;
				}

				if (code === 0 && !signal) {
					return;
				}

				const reason = signal ? `was terminated by signal ${signal}` : `exited with code ${code}`;
				const stderr = this.getCapturedStderr(record);

				this.logger.error(
					`Privileged worker unit "${spec.unit}" ${reason} before reporting completion${stderr ? ` (${stderr})` : ''}`,
				);

				this.finishJob(record, {
					id,
					state: 'failed',
					message: this.buildGenericFailureMessage(`Worker process ${reason} before reporting completion`, stderr),
					stderr,
					updatedAt: new Date().toISOString(),
				});
			});

			child.unref();

			this.logger.log(`Privileged worker spawned for unit "${spec.unit}" (job: ${id}, PID: ${child.pid ?? 'unknown'})`);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to spawn privileged worker for unit "${spec.unit}": ${err.message}`);

			// spawn() itself threw synchronously — the job never got a child at all, so there is
			// no 'error'/'exit' event to release the unit later. finishJob (not a manual delete)
			// keeps this consistent with every other failure path and releases the unit
			// immediately rather than leaving it reserved until the timeout.
			this.finishJob(record, {
				id,
				state: 'failed',
				message: err.message,
				updatedAt: new Date().toISOString(),
			});

			throw err;
		}

		this.startPolling(record);

		return { id };
	}

	getStatus(id: string): PrivilegedJobStatus | null {
		return this.jobs.get(id)?.lastStatus ?? null;
	}

	/**
	 * Subscribes to status ticks for a job. Unsubscribing only stops notifications to this
	 * handler — it never releases the job's unit; only a terminal state (via the status file or
	 * the spawned process failing) does that. See the class doc comment.
	 *
	 * Also replays the job's current `lastStatus` to this handler on the next microtask (after
	 * this call has already returned the unsubscribe function to the caller). Without this, a
	 * caller that subscribes after `run()` resolves — the normal, and only, calling convention —
	 * can race a job that reaches a terminal state (or any tick) before `onStatus` is called:
	 * the poll timer and the spawned process's own `exit`/`error` handlers only notify handlers
	 * that were already registered at that instant, so a handler added afterwards would otherwise
	 * never learn the job even ran. The replay is scheduled, not synchronous, specifically so the
	 * caller's own unsubscribe function is already in hand — calling it synchronously right after
	 * `onStatus` returns (a one-shot "peek" pattern) correctly cancels the replay too, checked via
	 * `record.handlers.has(handler)` immediately before invoking it. A terminal `lastStatus` can
	 * never be delivered twice this way: once a job is terminal, its poll timer is stopped and its
	 * process listeners are spent (see `finishJob`/`stopPolling`), so the replay is the only
	 * delivery that will ever happen. A `running` snapshot is simply an extra, harmless copy of
	 * what the poll interval already re-delivers on every tick regardless of whether it changed.
	 */
	onStatus(id: string, handler: StatusHandler): () => void {
		const record = this.jobs.get(id);

		if (!record) {
			return () => {};
		}

		record.handlers.add(handler);

		// A native Promise microtask, not queueMicrotask(): jest.useFakeTimers()
		// (the modern implementation every spec in this file — and the update
		// executor's and setup service's specs — relies on) fakes
		// queueMicrotask itself, so it would never fire without an explicit
		// timer advance. Promise scheduling is not on that fakeable list.
		void Promise.resolve().then(() => {
			if (record.handlers.has(handler)) {
				handler(record.lastStatus);
			}
		});

		return () => {
			record.handlers.delete(handler);
		};
	}

	/**
	 * The captured stderr accumulated for this job so far (see the `data` listener in `run()`),
	 * redacted line-by-line through the caller-supplied `redact` when given. `undefined` while
	 * nothing has arrived yet, so callers can cheaply skip an empty `stderr` field instead of
	 * exposing an empty string.
	 */
	private getCapturedStderr(record: JobRecord): string | undefined {
		if (record.stderrBuffer.length === 0) {
			return undefined;
		}

		const text = record.stderrBuffer.toString('utf-8');
		const redact = record.redact;

		if (!redact) {
			return text;
		}

		return text
			.split('\n')
			.map((line) => redact(line))
			.join('\n');
	}

	/**
	 * Builds an actionable failure message for a job whose child process never spawned at all
	 * (`error`/synchronous `spawn()` failure) — sudo/systemd-run rejecting the invocation outright
	 * is the common case this epic exists to fix, so the message always names the fix rather than
	 * leaving the admin with just a raw errno.
	 */
	private buildFailureMessage(summary: string, stderr?: string): string {
		const detail = stderr ? ` (${stderr})` : '';

		return `The smart-panel user cannot start privileged jobs: ${summary}${detail}. Re-run \`sudo smart-panel-service install\`, or add the sudoers grant from the installation guide.`;
	}

	/**
	 * Builds a plain failure message for a job whose child DID spawn (sudo/systemd-run accepted
	 * the invocation) but exited non-zero before writing a status file — the failure is inside the
	 * script itself, not a privilege refusal, so this must not carry the sudoers remediation text.
	 */
	private buildGenericFailureMessage(summary: string, stderr?: string): string {
		const detail = stderr ? ` (${stderr})` : '';

		return `${summary}${detail}.`;
	}

	private startPolling(record: JobRecord): void {
		record.pollTimer = setInterval(() => {
			if (Date.now() - record.startedAt > record.timeoutMs) {
				// Cleared here directly (not via stopPolling, which would also release the unit)
				// so this branch can never re-enter on a later tick while handleTimeout's stop
				// attempt / is-active check are still in flight — handleTimeout is async and this
				// callback does not (and must not) await it.
				clearInterval(record.pollTimer);
				record.pollTimer = null;

				void this.handleTimeout(record);

				return;
			}

			if (!existsSync(record.statusFile)) {
				return;
			}

			let mapped: Partial<PrivilegedJobStatus> | null;

			try {
				const raw = readFileSync(record.statusFile, 'utf-8');
				const rawParsed = JSON.parse(raw) as Record<string, unknown>;

				// mapStatus is caller-supplied code — a throw here must be handled exactly like a
				// torn/mid-write read, not propagate out of this interval callback.
				mapped = record.mapStatus ? record.mapStatus(rawParsed) : (rawParsed as Partial<PrivilegedJobStatus>);
			} catch (error) {
				const err = error as Error;

				this.logInvalidStatusOnce(record, `failed to read status: ${err.message}`);

				return;
			}

			if (!mapped || !isValidTickState(mapped.state)) {
				// mapStatus returned null, or the (mapped/native) state is missing or not one of
				// 'running' | 'complete' | 'failed' (never 'timeout' — reserved, see above) — not
				// a usable status. Ignored: the previous status stands, and this never advances
				// or releases the unit.
				this.logInvalidStatusOnce(
					record,
					mapped ? `unrecognized state ${JSON.stringify(mapped.state)}` : 'mapStatus returned null',
				);

				return;
			}

			// id and updatedAt are always service-owned — never trusted from the file/mapper —
			// so a script can never claim a different job's id or backdate its own progress.
			const status: PrivilegedJobStatus = {
				id: record.id,
				state: mapped.state,
				step: toOptionalString(mapped.step),
				message: toOptionalString(mapped.message),
				updatedAt: new Date().toISOString(),
			};

			record.lastStatus = status;

			this.notifyHandlers(record, status);

			if (status.state === 'complete' || status.state === 'failed') {
				this.stopPolling(record);
			}
		}, STATUS_POLL_INTERVAL_MS);
	}

	/**
	 * Attempts to stop the still-running scope for a unit whose job just hit its hard timeout, via
	 * `sudo -n systemd-run --scope --quiet --unit=<unit>-stop systemctl stop <unit>` — its own
	 * short-lived scope, run under the SAME `systemd-run *` sudoers grant `run()` already relies
	 * on (see the installation guide); no new privileged command is introduced. Never rejects: a
	 * refusal or spawn failure here must not stop the `systemctl is-active` confirmation that
	 * follows in `handleTimeout` from running.
	 */
	private stopUnit(unit: string): Promise<void> {
		return new Promise((resolve) => {
			let settled = false;
			let timer: NodeJS.Timeout | null = null;

			const settle = () => {
				if (settled) {
					return;
				}

				settled = true;

				if (timer) {
					clearTimeout(timer);
					timer = null;
				}

				resolve();
			};

			try {
				const child = spawn(
					'sudo',
					['-n', 'systemd-run', '--scope', '--quiet', `--unit=${unit}-stop`, 'systemctl', 'stop', unit],
					{ stdio: 'ignore' },
				);

				child.on('exit', settle);
				child.on('error', settle);

				// A scope that refuses to stop must not strand the job: give up waiting and let
				// the is-active read below decide, exactly like a refused stop attempt.
				timer = setTimeout(settle, STOP_ATTEMPT_TIMEOUT_MS);
				timer.unref();
				child.unref();
			} catch {
				// spawn() itself threw synchronously (e.g. EAGAIN) — treated exactly like the
				// child spawning and then erroring: still proceed to the is-active read below.
				settle();
			}
		});
	}

	/**
	 * Unprivileged read of whether `unit` is still active — the same `systemctl is-active`
	 * pattern TailscaleNodeManagedService already uses to probe a systemd unit. Any failure (unit
	 * not found, probe timeout, systemctl missing) resolves `false` so a probe failure can never
	 * keep a unit reserved forever by itself; only a confirmed 'active' does that.
	 */
	private isUnitActive(unit: string): Promise<boolean> {
		return new Promise((resolve) => {
			execFile('systemctl', ['is-active', unit], { timeout: IS_ACTIVE_PROBE_TIMEOUT_MS }, (error, stdout) => {
				if (error) {
					resolve(false);

					return;
				}

				resolve((stdout ?? '').trim() === 'active');
			});
		});
	}

	/**
	 * Runs once a job's hard timeout elapses (the poll tick above has already stopped the poll
	 * timer, without releasing the unit, before calling this). Actually stops the still-running
	 * scope before freeing the unit for reuse — without this, a retried `run()` for the same unit
	 * would race the still-alive old `systemd-run --scope` process and fail opaquely instead of
	 * either succeeding or reporting a clear reason (see the class doc comment / issue #950).
	 *
	 * If the unit is confirmed stopped, proceeds exactly like the previous timeout behavior:
	 * `finishJob` with `state: 'timeout'`, freeing the unit. If it is still active after the stop
	 * attempt, the unit is deliberately kept reserved in `busyUnits` — `run()`'s busy-unit check
	 * recognizes this exact case (a busy unit whose job's `lastStatus.state` is `'timeout'`, which
	 * can only happen via this path) and reports it with equally explicit wording.
	 */
	private async handleTimeout(record: JobRecord): Promise<void> {
		this.logger.error(`Privileged worker unit "${record.unit}" timed out after ${record.timeoutMs}ms`);

		await this.stopUnit(record.unit);

		const stillActive = await this.isUnitActive(record.unit);
		const stderr = this.getCapturedStderr(record);

		// The main child's own 'exit'/'error' handler (guarded the same way) could have already
		// finished this job — e.g. it happened to exit right as the stop attempt / is-active check
		// above were in flight. finishJob below has its own such guard; this branch bypasses
		// finishJob (it must not release the unit), so it needs the same check explicitly.
		if (record.lastStatus.state !== 'running') {
			return;
		}

		if (stillActive) {
			this.logger.error(
				`Privileged worker unit "${record.unit}" is still running after a timeout stop attempt; keeping it reserved.`,
			);

			const status: PrivilegedJobStatus = {
				id: record.id,
				state: 'timeout',
				message: `Privileged worker unit "${record.unit}" timed out and is still running after a stop attempt; it remains reserved until confirmed stopped.`,
				stderr,
				updatedAt: new Date().toISOString(),
			};

			record.lastStatus = status;

			this.notifyHandlers(record, status);

			return;
		}

		this.finishJob(record, {
			id: record.id,
			state: 'timeout',
			stderr,
			updatedAt: new Date().toISOString(),
		});
	}

	/** Logs at most once per job so a script stuck writing an unusable status doesn't spam the log every 3 seconds. */
	private logInvalidStatusOnce(record: JobRecord, reason: string): void {
		if (record.loggedInvalidStatus) {
			return;
		}

		record.loggedInvalidStatus = true;

		this.logger.debug(
			`Privileged worker unit "${record.unit}" (job: ${record.id}) reported an unusable status: ${reason}`,
		);
	}

	/**
	 * A no-op once the job is already terminal — belt-and-suspenders alongside each call site's
	 * own `state !== 'running'` pre-check, so a duplicate/racing call (e.g. a stale child event
	 * arriving after the status file already reported completion) can never overwrite an
	 * already-settled result or re-notify handlers a second time.
	 */
	private finishJob(record: JobRecord, status: PrivilegedJobStatus): void {
		if (record.lastStatus.state !== 'running') {
			return;
		}

		record.lastStatus = status;

		this.notifyHandlers(record, status);

		this.stopPolling(record);
	}

	/**
	 * Snapshots and notifies every current subscriber with a status tick — shared by the poll
	 * tick, `finishJob`, and `handleTimeout`'s "still running" path. Snapshotting before iterating
	 * means a handler added re-entrantly (e.g. another handler calling `onStatus()` from inside
	 * its own delivery) is not also visited by this same loop, on top of its own replay.
	 */
	private notifyHandlers(record: JobRecord, status: PrivilegedJobStatus): void {
		for (const handler of [...record.handlers]) {
			handler(status);
		}
	}

	private stopPolling(record: JobRecord): void {
		if (record.pollTimer) {
			clearInterval(record.pollTimer);
			record.pollTimer = null;
		}

		// A newer job may already have reserved this unit (this job's own reservation was freed
		// earlier by its own terminal status) — only clear the entry if it still belongs to this
		// job, so a stale/late event from an old record can never evict a newer job's lock.
		if (this.busyUnits.get(record.unit) === record.id) {
			this.busyUnits.delete(record.unit);

			// The unit is actually free at this exact point, not merely "the job reached a
			// terminal status" — a job kept reserved in busyUnits (handleTimeout's "still
			// running after a stop attempt" case) never reaches this branch, so it is never
			// scheduled for pruning while it still occupies its unit. See schedulePrune.
			this.schedulePrune(record);
		}
	}

	/**
	 * Schedules this job's record for removal once its retention window (`PRUNE_AFTER_MS`)
	 * elapses. Only ever called from `stopPolling`, at the exact point the unit is actually freed —
	 * see the call site. Once the timer fires, `getStatus(id)` starts returning `null` for this job
	 * (matching its existing behavior for an unknown id) and the handler set is cleared so no stale
	 * closures are retained.
	 */
	private schedulePrune(record: JobRecord): void {
		if (record.pruneTimer) {
			return;
		}

		record.pruneTimer = setTimeout(() => {
			record.pruneTimer = null;
			record.handlers.clear();
			this.jobs.delete(record.id);
		}, PRUNE_AFTER_MS);

		record.pruneTimer.unref();
	}
}
