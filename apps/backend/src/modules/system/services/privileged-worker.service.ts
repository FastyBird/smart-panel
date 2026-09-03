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
}

export interface PrivilegedJobStatus {
	id: string;
	state: 'running' | 'complete' | 'failed' | 'timeout';
	step?: string;
	message?: string;
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
}

const STATUS_POLL_INTERVAL_MS = 3_000; // Poll worker status every 3 seconds
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Runs a script as a detached, root-owned systemd scope via `sudo -n systemd-run` and tracks its
 * progress through a JSON status file the script writes itself.
 *
 * Extracted from UpdateExecutorService so any privileged, long-running operation (OS update,
 * Tailscale setup, ...) can reuse the same spawn / poll / timeout / one-job-per-unit machinery
 * instead of re-implementing it. Callers own the meaning of the status file's `step`/`message`
 * fields — this service only spawns the job, polls the file every three seconds, forwards
 * whatever is parsed from it, and enforces the hard timeout and one-job-per-unit guard.
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
			child.on('error', (error) => {
				this.logger.error(`Privileged worker unit "${spec.unit}" failed to spawn: ${error.message}`);

				this.finishJob(record, {
					id,
					state: 'failed',
					message: error.message,
					updatedAt: new Date().toISOString(),
				});
			});

			child.unref();

			this.logger.log(`Privileged worker spawned for unit "${spec.unit}" (job: ${id}, PID: ${child.pid ?? 'unknown'})`);
		} catch (error) {
			const err = error as Error;

			this.jobs.delete(id);
			this.busyUnits.delete(spec.unit);

			this.logger.error(`Failed to spawn privileged worker for unit "${spec.unit}": ${err.message}`);

			throw err;
		}

		this.startPolling(record);

		return { id };
	}

	getStatus(id: string): PrivilegedJobStatus | null {
		return this.jobs.get(id)?.lastStatus ?? null;
	}

	onStatus(id: string, handler: StatusHandler): () => void {
		const record = this.jobs.get(id);

		if (!record) {
			return () => {};
		}

		record.handlers.add(handler);

		return () => {
			record.handlers.delete(handler);

			// Nobody is watching this job any more — stop polling its status file and
			// free its unit so a new job can start without waiting for the hard timeout.
			if (record.handlers.size === 0) {
				this.stopPolling(record);
			}
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

			let parsed: PrivilegedJobStatus;

			try {
				const raw = readFileSync(record.statusFile, 'utf-8');

				parsed = JSON.parse(raw) as PrivilegedJobStatus;
			} catch {
				// File may be mid-write (script writes to a temp file then renames it) — retry next cycle
				return;
			}

			record.lastStatus = parsed;

			for (const handler of record.handlers) {
				handler(parsed);
			}

			if (parsed.state === 'complete' || parsed.state === 'failed') {
				this.stopPolling(record);
			}
		}, STATUS_POLL_INTERVAL_MS);
	}

	private finishJob(record: JobRecord, status: PrivilegedJobStatus): void {
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

		this.busyUnits.delete(record.unit);
	}
}
