import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { AUTOMATIONS_MODULE_NAME, AutomationRunStatus, EventType } from '../automations.constants';
import { RunRecord } from '../engine/run-walker';
import { AutomationEntity } from '../entities/automations.entity';

const RUN_STATUS: Record<string, AutomationRunStatus | undefined> = {
	completed: AutomationRunStatus.COMPLETED,
	failed: AutomationRunStatus.FAILED,
	cancelled: AutomationRunStatus.CANCELLED,
	interrupted: AutomationRunStatus.INTERRUPTED,
};

/**
 * Records what the walker reports about runs (ADR 0003, decision 15: the pure walker is split from the
 * service that persists).
 *
 * For now it keeps `last_triggered_at` and `last_run_status` of the automation up to date. Run history and
 * traces are not stored yet; the callbacks below are where they will be written:
 *
 * - `runParked`: the run will outlive the current tick, so this is the moment for the `running` marker;
 * - `runEnded`: the outcome is known;
 * - `runSettled`: nothing of the run is executing any more and its trace is complete.
 *
 * A run that never parks costs one write, when it ends. Writes are queued, so they reach the database in
 * the order the runs reported them, and a failed write never reaches the engine.
 *
 * Parallel runs end in any order, so `last_triggered_at` only ever moves forward: a run that started
 * earlier and ended later leaves it alone. `last_run_status` is that of the run that ended last.
 */
@Injectable()
export class AutomationRunService {
	private readonly logger = createExtensionLogger(AUTOMATIONS_MODULE_NAME, 'AutomationRunService');

	private writes: Promise<void> = Promise.resolve();

	constructor(
		@InjectRepository(AutomationEntity)
		private readonly repository: Repository<AutomationEntity>,
		private readonly eventEmitter: EventEmitter2,
	) {}

	runStarted(record: RunRecord): void {
		this.logger.debug(
			`[RUN] Run id=${record.id} of automation id=${record.automationId} started at node=${record.trigger.nodeId}`,
		);
	}

	runParked(record: RunRecord): void {
		this.enqueue(record.automationId, async () => {
			// The run may have ended while this write was waiting; its end is then written right behind
			await this.write(record.automationId, new Date(record.startedAt));
		});
	}

	runEnded(record: RunRecord): void {
		const status = RUN_STATUS[record.status];

		this.logger.debug(
			`[RUN] Run id=${record.id} of automation id=${record.automationId} ended status=${record.status}` +
				(record.endReason !== undefined ? ` reason=${record.endReason}` : ''),
		);

		if (status === undefined) return;

		this.enqueue(record.automationId, async () => {
			await this.write(record.automationId, new Date(record.startedAt), status);
		});
	}

	runSettled(_record: RunRecord): void {
		// The complete trace is available here; storing it is not part of the engine yet
	}

	/** Resolves once every write asked for so far has finished */
	async settled(): Promise<void> {
		await this.writes;
	}

	private async write(id: string, startedAt: Date, lastRunStatus?: AutomationRunStatus): Promise<void> {
		// This queue is the only writer of the column, so what is read here is what the write is compared to
		const stored = await this.repository.findOne({ where: { id }, select: { id: true, lastTriggeredAt: true } });

		if (!stored) return;

		const newer = !stored.lastTriggeredAt || new Date(stored.lastTriggeredAt).getTime() < startedAt.getTime();
		const changes: { lastTriggeredAt?: Date; lastRunStatus?: AutomationRunStatus } = {
			...(newer ? { lastTriggeredAt: startedAt } : {}),
			...(lastRunStatus !== undefined ? { lastRunStatus } : {}),
		};

		if (Object.keys(changes).length === 0) return;

		// Neither the revision nor `updated_at` moves: the automation was not edited
		const result = await this.repository.update({ id }, changes);

		if (result.affected !== 1) return;

		const automation = await this.repository.findOneBy({ id });

		if (automation) {
			this.eventEmitter.emit(EventType.AUTOMATION_UPDATED, automation);
		}
	}

	private enqueue(id: string, write: () => Promise<void>): void {
		this.writes = this.writes.then(write).catch((error: unknown) => {
			this.logger.warn(
				`[RUN] Failed to record a run of automation id=${id}: ${error instanceof Error ? error.message : 'unknown error'}`,
			);
		});
	}
}
