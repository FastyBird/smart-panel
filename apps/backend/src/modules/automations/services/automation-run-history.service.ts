import { LessThan, Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import {
	AUTOMATIONS_MODULE_NAME,
	AUTOMATION_RUNS_KEPT_PER_AUTOMATION,
	AUTOMATION_RUNS_RETENTION_DAYS,
	AUTOMATION_RUN_INTERRUPTED_BY_RESTART,
	AutomationRunRecordStatus,
} from '../automations.constants';
import { RunRecord } from '../engine/run-walker';
import { AutomationRunEntity } from '../entities/automation-runs.entity';
import { AUTOMATION_RUN_RECORD_STATUS, createAutomationRunTraceModel } from '../models/automation-run-trace.model';
import { AutomationRunSummaryModel } from '../models/automation-runs.model';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** Everything of a run but its trace, for lists */
const SUMMARY_COLUMNS = {
	id: true,
	createdAt: true,
	updatedAt: true,
	automationId: true,
	revision: true,
	status: true,
	triggerNodeId: true,
	manual: true,
	startedAt: true,
	finishedAt: true,
	durationMs: true,
	endReason: true,
} as const;

/** What is stored of a run: taken from the record the moment it is handed over, so later changes do not leak in */
export type AutomationRunRow = Pick<
	AutomationRunEntity,
	| 'id'
	| 'automationId'
	| 'revision'
	| 'status'
	| 'triggerNodeId'
	| 'manual'
	| 'startedAt'
	| 'finishedAt'
	| 'durationMs'
	| 'endReason'
	| 'trace'
>;

export const createAutomationRunRow = (record: RunRecord): AutomationRunRow => ({
	id: record.id,
	automationId: record.automationId,
	revision: record.revision,
	status: AUTOMATION_RUN_RECORD_STATUS[record.status],
	triggerNodeId: record.trigger.nodeId,
	manual: record.trigger.manual,
	startedAt: new Date(record.startedAt),
	finishedAt: record.finishedAt !== undefined ? new Date(record.finishedAt) : null,
	durationMs: record.durationMs ?? null,
	endReason: record.endReason ?? null,
	trace: createAutomationRunTraceModel(record),
});

/**
 * The stored run history (ADR 0003, decision 12): one row per run in SQLite, the last
 * `AUTOMATION_RUNS_KEPT_PER_AUTOMATION` runs of an automation, none older than
 * `AUTOMATION_RUNS_RETENTION_DAYS` days.
 *
 * It only stores and reads. When something is written is decided by `AutomationRunService`, which also
 * keeps the writes in order.
 */
@Injectable()
export class AutomationRunHistoryService {
	private readonly logger = createExtensionLogger(AUTOMATIONS_MODULE_NAME, 'AutomationRunHistoryService');

	constructor(
		@InjectRepository(AutomationRunEntity)
		private readonly repository: Repository<AutomationRunEntity>,
	) {}

	/** The runs of an automation without their traces, newest first */
	async findAllForAutomation(automationId: string): Promise<AutomationRunSummaryModel[]> {
		return this.repository.find({
			where: { automationId },
			select: SUMMARY_COLUMNS,
			order: { startedAt: 'DESC', createdAt: 'DESC', id: 'DESC' },
		});
	}

	async findOne(id: string): Promise<AutomationRunEntity | null> {
		return this.repository.findOneBy({ id });
	}

	/**
	 * Writes a run, or rewrites the row its `running` marker left, and brings the automation back under
	 * the number of runs kept.
	 */
	async store(row: AutomationRunRow): Promise<void> {
		// The marker of a run may have been removed with its automation or by the retention; it is then written anew
		await this.repository.save(this.repository.create(row));

		await this.enforceCap(row.automationId);
	}

	/**
	 * Ends every run still marked `running` as `interrupted`. Called before the engine starts, when no run
	 * can be active: whatever is still `running` was cut off by a restart or a power loss, and its Delay
	 * will never continue. When it stopped is not known, so it gets no end time.
	 *
	 * @returns the runs that were interrupted, without their traces
	 */
	async interruptRunning(reason: string = AUTOMATION_RUN_INTERRUPTED_BY_RESTART): Promise<AutomationRunSummaryModel[]> {
		const leftover = await this.repository.find({
			where: { status: AutomationRunRecordStatus.RUNNING },
			select: SUMMARY_COLUMNS,
			order: { startedAt: 'ASC' },
		});

		if (leftover.length === 0) {
			return [];
		}

		await this.repository.update(
			{ status: AutomationRunRecordStatus.RUNNING },
			{ status: AutomationRunRecordStatus.INTERRUPTED, endReason: reason },
		);

		this.logger.log(`[HISTORY] Marked ${leftover.length} run(s) cut off by a restart as interrupted`);

		return leftover.map((run) => ({ ...run, status: AutomationRunRecordStatus.INTERRUPTED, endReason: reason }));
	}

	/** Deletes the runs that started more than the retention period ago, whatever their automation still holds */
	async pruneExpired(now: Date = new Date()): Promise<number> {
		const cutoff = new Date(now.getTime() - AUTOMATION_RUNS_RETENTION_DAYS * DAY_IN_MS);
		const result = await this.repository.delete({ startedAt: LessThan(cutoff) });

		return result.affected ?? 0;
	}

	async clear(): Promise<void> {
		await this.repository.clear();
	}

	private async enforceCap(automationId: string): Promise<void> {
		const excess = (await this.repository.count({ where: { automationId } })) - AUTOMATION_RUNS_KEPT_PER_AUTOMATION;

		if (excess <= 0) {
			return;
		}

		const oldest = await this.repository.find({
			where: { automationId },
			select: { id: true },
			order: { startedAt: 'ASC', createdAt: 'ASC', id: 'ASC' },
			take: excess,
		});

		if (oldest.length > 0) {
			await this.repository.delete(oldest.map((run) => run.id));
		}
	}
}
