import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { AUTOMATIONS_MODULE_NAME, AutomationRunStatus, EventType } from '../automations.constants';
import { RunRecord, RunStep } from '../engine/run-walker';
import { AutomationEntity } from '../entities/automations.entity';

import {
	AutomationRunHistoryService,
	AutomationRunRow,
	createAutomationRunRow,
} from './automation-run-history.service';

const RUN_STATUS: Record<string, AutomationRunStatus | undefined> = {
	completed: AutomationRunStatus.COMPLETED,
	failed: AutomationRunStatus.FAILED,
	cancelled: AutomationRunStatus.CANCELLED,
	interrupted: AutomationRunStatus.INTERRUPTED,
};

export type AutomationRunStepListener = (record: RunRecord, step: RunStep) => void;

const toIsoString = (value: Date | string | null): string | null =>
	value instanceof Date ? value.toISOString() : value;

/** What `AutomationsModule.Run.Started` and `AutomationsModule.Run.Completed` carry: the run without its trace */
export const createAutomationRunEventPayload = (row: Omit<AutomationRunRow, 'trace'>): Record<string, unknown> => ({
	id: row.id,
	automation_id: row.automationId,
	revision: row.revision,
	status: row.status,
	trigger_node_id: row.triggerNodeId,
	manual: row.manual,
	started_at: toIsoString(row.startedAt),
	finished_at: toIsoString(row.finishedAt),
	duration_ms: row.durationMs,
	end_reason: row.endReason,
});

/**
 * Records what the walker reports about runs (ADR 0003, decision 15: the pure walker is split from the
 * service that persists).
 *
 * It keeps `last_triggered_at` and `last_run_status` of the automation up to date, hands the runs to the
 * run history and announces them on the bus:
 *
 * - `runStarted`: `AutomationsModule.Run.Started` is announced; nothing is written;
 * - `runParked`: the run will outlive the current tick, so its `running` marker is written, with the trace
 *   up to the Delay it parked on;
 * - `runEnded`: the outcome is known and is written to the automation;
 * - `runSettled`: nothing of the run is executing any more and its trace is complete. The run is written
 *   to the history - once, for a run that never parked - and `AutomationsModule.Run.Completed` is
 *   announced.
 *
 * A cancelled run settles later than it ends when one of its nodes is still executing. Should the engine
 * stop in between, `flush()` writes such runs with the trace they have.
 *
 * Writes are queued, so they reach the database in the order the runs reported them, and a failed write
 * never reaches the engine.
 *
 * Parallel runs end in any order, so `last_triggered_at` only ever moves forward: a run that started
 * earlier and ended later leaves it alone. `last_run_status` is that of the run that ended last.
 */
@Injectable()
export class AutomationRunService {
	private readonly logger = createExtensionLogger(AUTOMATIONS_MODULE_NAME, 'AutomationRunService');

	private writes: Promise<void> = Promise.resolve();

	/** Runs whose outcome is known and whose trace is not complete yet */
	private readonly unsettled = new Map<string, RunRecord>();

	private stepListener: AutomationRunStepListener | undefined;

	constructor(
		@InjectRepository(AutomationEntity)
		private readonly repository: Repository<AutomationEntity>,
		private readonly eventEmitter: EventEmitter2,
		private readonly history: AutomationRunHistoryService,
	) {}

	runStarted(record: RunRecord): void {
		this.logger.debug(
			`[RUN] Run id=${record.id} of automation id=${record.automationId} started at node=${record.trigger.nodeId}`,
		);

		this.eventEmitter.emit(EventType.RUN_STARTED, createAutomationRunEventPayload(createAutomationRunRow(record)));
	}

	runParked(record: RunRecord): void {
		// What is stored is the run as it is now: it may have ended by the time the write is made
		const row = createAutomationRunRow(record);

		this.enqueue(`recording a run of automation id=${record.automationId}`, async () => {
			// The run may have ended while this write was waiting; its end is then written right behind
			if (await this.write(record.automationId, new Date(record.startedAt))) {
				await this.history.store(row);
			}
		});
	}

	runEnded(record: RunRecord): void {
		const status = RUN_STATUS[record.status];

		this.logger.debug(
			`[RUN] Run id=${record.id} of automation id=${record.automationId} ended status=${record.status}` +
				(record.endReason !== undefined ? ` reason=${record.endReason}` : ''),
		);

		if (status === undefined) return;

		this.unsettled.set(record.id, record);

		this.enqueue(`recording a run of automation id=${record.automationId}`, async () => {
			await this.write(record.automationId, new Date(record.startedAt), status);
		});
	}

	runSettled(record: RunRecord): void {
		this.unsettled.delete(record.id);

		this.storeRun(record);
	}

	/** A run reached a node, or a Delay let it go on. Nothing is stored: the trace is written when the run ends. */
	runStep(record: RunRecord, step: RunStep): void {
		this.stepListener?.(record, step);
	}

	/**
	 * Sets who is told about every step of every run while it happens. There is one listener; the module
	 * sets the one that passes the steps to the clients watching the automation.
	 */
	setStepListener(listener: AutomationRunStepListener | undefined): void {
		this.stepListener = listener;
	}

	/**
	 * Writes the runs that ended and have a node still executing, with the trace they have. For the engine
	 * that stops: such a node may not return before the application is gone.
	 */
	flush(): void {
		for (const record of this.unsettled.values()) {
			this.storeRun(record);
		}

		// A run that settles after all is written once more, then with its complete trace
		this.unsettled.clear();
	}

	/**
	 * Ends the runs a restart or a power loss cut off: every stored run still `running` becomes
	 * `interrupted`, and so does `last_run_status` of its automation unless a later run has ended since.
	 * Called before the engine starts, when no run can be active. Nothing is announced: the engine is not
	 * running yet, and a client reads the state when it connects.
	 */
	async interruptLeftoverRuns(): Promise<number> {
		let interrupted = 0;

		this.enqueue('ending the runs a restart cut off', async () => {
			const runs = await this.history.interruptRunning();

			interrupted = runs.length;

			// Oldest first, so the newest interrupted run of an automation is the one that counts
			for (const run of runs) {
				const startedAt = new Date(run.startedAt).getTime();
				const stored = await this.repository.findOne({
					where: { id: run.automationId },
					select: { id: true, lastTriggeredAt: true },
				});

				// A run that started later has ended since: its outcome is the last one
				if (!stored || (stored.lastTriggeredAt && new Date(stored.lastTriggeredAt).getTime() > startedAt)) {
					continue;
				}

				await this.repository.update({ id: run.automationId }, { lastRunStatus: AutomationRunStatus.INTERRUPTED });
			}
		});

		await this.settled();

		return interrupted;
	}

	/** Nightly: runs older than the retention period are deleted (ADR 0003, decision 12) */
	@Cron('40 3 * * *')
	pruneExpiredRuns(): void {
		this.enqueue('removing expired runs', async () => {
			const deleted = await this.history.pruneExpired();

			if (deleted > 0) {
				this.logger.log(`[RUN] Retention removed ${deleted} expired run(s)`);
			}
		});
	}

	/** Resolves once every write asked for so far has finished */
	async settled(): Promise<void> {
		let awaited: Promise<void>;

		do {
			awaited = this.writes;

			await awaited;
			// A run that was cancelled completes its trace a moment after it ended, and is only then written
		} while (awaited !== this.writes);
	}

	private storeRun(record: RunRecord): void {
		const row = createAutomationRunRow(record);

		this.enqueue(`recording a run of automation id=${record.automationId}`, async () => {
			try {
				// A run of an automation that was deleted meanwhile is not kept: its history went with it
				if (await this.repository.existsBy({ id: row.automationId })) {
					await this.history.store(row);
				}
			} finally {
				// A client following the run must learn that it is over even when it could not be stored
				this.eventEmitter.emit(EventType.RUN_COMPLETED, createAutomationRunEventPayload(row));
			}
		});
	}

	/** @returns whether the automation still exists */
	private async write(id: string, startedAt: Date, lastRunStatus?: AutomationRunStatus): Promise<boolean> {
		// This queue is the only writer of the column, so what is read here is what the write is compared to
		const stored = await this.repository.findOne({ where: { id }, select: { id: true, lastTriggeredAt: true } });

		if (!stored) return false;

		const newer = !stored.lastTriggeredAt || new Date(stored.lastTriggeredAt).getTime() < startedAt.getTime();
		const changes: { lastTriggeredAt?: Date; lastRunStatus?: AutomationRunStatus } = {
			...(newer ? { lastTriggeredAt: startedAt } : {}),
			...(lastRunStatus !== undefined ? { lastRunStatus } : {}),
		};

		if (Object.keys(changes).length === 0) return true;

		// Neither the revision nor `updated_at` moves: the automation was not edited
		const result = await this.repository.update({ id }, changes);

		if (result.affected !== 1) return false;

		const automation = await this.repository.findOneBy({ id });

		if (automation) {
			this.eventEmitter.emit(EventType.AUTOMATION_UPDATED, automation);
		}

		return true;
	}

	private enqueue(what: string, write: () => Promise<void>): void {
		this.writes = this.writes.then(write).catch((error: unknown) => {
			this.logger.warn(`[RUN] Failed while ${what}: ${error instanceof Error ? error.message : 'unknown error'}`);
		});
	}
}
