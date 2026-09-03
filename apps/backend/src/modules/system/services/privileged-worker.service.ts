import { existsSync, readFileSync } from 'fs';
import { spawn } from 'node:child_process';
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
	/** True once an unusable tick (missing/invalid state, or mapStatus returning null) has been
	 *  logged for this job — caps the debug log at one per job instead of one per bad tick. */
	loggedInvalidStatus: boolean;
}

const STATUS_POLL_INTERVAL_MS = 3_000; // Poll worker status every 3 seconds
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

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
			loggedInvalidStatus: false,
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
				{ detached: true, stdio: 'ignore' },
			);

			// Detached + unref'd, so a crash of this process's own error handling must not
			// crash the process — sudo/systemd-run missing is a config error, not a fatal one.
			// Guarded the same way as 'exit' below: a stale/late 'error' after the job already
			// went terminal (via the status file, or the 'exit' handler) must not re-fire it.
			child.on('error', (error) => {
				if (record.lastStatus.state !== 'running') {
					return;
				}

				this.logger.error(`Privileged worker unit "${spec.unit}" failed to spawn: ${error.message}`);

				this.finishJob(record, {
					id,
					state: 'failed',
					message: error.message,
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

				this.logger.error(`Privileged worker unit "${spec.unit}" ${reason} before reporting completion`);

				this.finishJob(record, {
					id,
					state: 'failed',
					message: `Worker process ${reason}`,
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
	 */
	onStatus(id: string, handler: StatusHandler): () => void {
		const record = this.jobs.get(id);

		if (!record) {
			return () => {};
		}

		record.handlers.add(handler);

		return () => {
			record.handlers.delete(handler);
		};
	}

	private startPolling(record: JobRecord): void {
		record.pollTimer = setInterval(() => {
			if (Date.now() - record.startedAt > record.timeoutMs) {
				this.logger.error(`Privileged worker unit "${record.unit}" timed out after ${record.timeoutMs}ms`);

				this.finishJob(record, { id: record.id, state: 'timeout', updatedAt: new Date().toISOString() });

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

			for (const handler of record.handlers) {
				handler(status);
			}

			if (status.state === 'complete' || status.state === 'failed') {
				this.stopPolling(record);
			}
		}, STATUS_POLL_INTERVAL_MS);
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

		for (const handler of record.handlers) {
			handler(status);
		}

		this.stopPolling(record);
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
		}
	}
}
