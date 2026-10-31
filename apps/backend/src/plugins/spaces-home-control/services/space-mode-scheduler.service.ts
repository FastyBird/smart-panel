import { CronJob } from 'cron';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

import { ConflictException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';

import { createExtensionLogger } from '../../../common/logger';
import { BaseManagedExtensionService } from '../../../modules/extensions/services/base-managed-extension.service';
import { SpaceActivityStateEntity } from '../entities/space-activity-state.entity';
import { SpaceModeScheduleEntity } from '../entities/space-mode-schedule.entity';
import { ScheduleRuntimeStatus, SpaceModeScheduleStateModel } from '../models/space-mode-schedule.model';
import { MINUTE_MS, evaluateSchedule, scheduleOccurrenceKey } from '../schedule/schedule-time';
import {
	SPACE_SCHEDULE_CHANGED,
	ScheduleOccurrence,
	ScheduledActivityAdmission,
} from '../schedule/space-mode-schedule.types';
import { SPACES_HOME_CONTROL_PLUGIN_NAME } from '../spaces-home-control.constants';

import { SpaceModeScheduleConfigService } from './space-mode-schedule-config.service';
import { SpaceModeService } from './space-mode.service';

const JOB_NAME = 'spaceModeSchedules';

@Injectable()
export class SpaceModeSchedulerService extends BaseManagedExtensionService implements OnModuleDestroy {
	readonly owner = { kind: 'plugin', type: SPACES_HOME_CONTROL_PLUGIN_NAME } as const;
	readonly serviceId = 'activity-scheduler';
	private readonly logger = createExtensionLogger(SPACES_HOME_CONTROL_PLUGIN_NAME, 'SpaceModeSchedulerService');
	private job: CronJob | null = null;
	private cycle: Promise<{ attempts: Promise<void>[] }> | null = null;
	private readonly pending = new Map<string, Promise<void>>();
	private cycleStartedAt: number | null = null;
	private rescanRequested = false;
	private epoch: object | null = null;

	constructor(
		private readonly database: DataSource,
		private readonly schedules: SpaceModeScheduleConfigService,
		private readonly modes: SpaceModeService,
		private readonly registry: SchedulerRegistry,
		private readonly events: EventEmitter2,
	) {
		super();
	}

	/** Register the minute scan before establishing a fresh, non-replaying runtime epoch. */
	async start(): Promise<void> {
		await this.withLock(async () => {
			if (this.state === 'started') return;
			this.state = 'starting';
			try {
				this.job = CronJob.from({
					cronTime: '0 * * * * *',
					threshold: MINUTE_MS - 1,
					onTick: async () => {
						await this.scanCycle();
					},
					unrefTimeout: true,
					waitForCompletion: false,
					errorHandler: (cause) =>
						this.logger.error('Schedule check failed', cause instanceof Error ? cause : 'Unknown scheduling failure'),
				});
				this.registry.addCronJob(JOB_NAME, this.job);
				const minute = Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;
				// Evaluate current plans on GET, but never run missed or interrupted occurrences at startup.
				await this.database
					.createQueryBuilder()
					.update(SpaceModeScheduleEntity)
					.set({
						cursor: () => `CASE WHEN cursor IS NULL OR cursor < ${minute} THEN ${minute} ELSE cursor END`,
						pendingOccurrenceId: () => `CASE WHEN lastAttemptStatus = 'claimed' THEN NULL ELSE pendingOccurrenceId END`,
						lastAttemptStatus: () =>
							`CASE WHEN lastAttemptStatus = 'claimed' THEN 'interrupted' ELSE lastAttemptStatus END`,
					})
					.execute();
				this.job.start();
				this.state = 'started';
				this.epoch = {};
			} catch (cause) {
				await this.job?.stop();
				if (this.ownsRegisteredJob()) this.registry.deleteCronJob(JOB_NAME);
				this.job = null;
				this.epoch = null;
				this.state = 'error';
				throw cause;
			}
		});
	}

	/** Revoke admission first, then join the scan and every original per-space activation. */
	async stop(): Promise<void> {
		await this.withLock(async () => {
			this.state = 'stopping';
			this.epoch = null;
			this.rescanRequested = false;
			await this.job?.stop();
			if (this.ownsRegisteredJob()) this.registry.deleteCronJob(JOB_NAME);
			this.job = null;
			await this.cycle;
			await Promise.allSettled([...this.pending.values()]);
			this.state = 'stopped';
		});
	}
	onModuleDestroy(): Promise<void> {
		return this.stop();
	}
	isHealthy(): Promise<boolean> {
		return Promise.resolve(
			this.state === 'started' &&
				this.ownsRegisteredJob() &&
				this.job?.isActive === true &&
				(this.cycleStartedAt === null || Date.now() - this.cycleStartedAt <= MINUTE_MS),
		);
	}

	private ownsRegisteredJob(): boolean {
		return (
			this.job !== null && this.registry.doesExist('cron', JOB_NAME) && this.registry.getCronJob(JOB_NAME) === this.job
		);
	}

	/** Explicit callers join this scan's attempts; cron ticks coalesce requests for a short scan. */
	async runCycle(now = Date.now()): Promise<void> {
		const { attempts } = await this.scanCycle(now);
		await Promise.allSettled(attempts);
	}

	private scanCycle(now = Date.now()): Promise<{ attempts: Promise<void>[] }> {
		if (this.state !== 'started' || !this.ownsRegisteredJob() || !this.job?.isActive)
			return Promise.resolve({ attempts: [] });
		if (this.cycle !== null) {
			this.rescanRequested = true;
			return this.cycle;
		}
		this.cycleStartedAt = now;
		this.cycle = this.drainScans().finally(() => {
			this.cycle = null;
			this.cycleStartedAt = null;
		});
		return this.cycle;
	}

	/** Coalesce overlapping ticks; every follow-up reads the current minute, never a waiting list of old ticks. */
	private async drainScans(): Promise<{ attempts: Promise<void>[] }> {
		const attempts: Promise<void>[] = [];
		do {
			this.rescanRequested = false;
			attempts.push(...(await this.check()).attempts);
		} while (this.rescanRequested && this.state === 'started');
		return { attempts };
	}

	private async check(): Promise<{ attempts: Promise<void>[] }> {
		const attempts: Promise<void>[] = [];
		try {
			const rows = await this.database.getRepository(SpaceModeScheduleEntity).findBy({ enabled: true });
			// A slow read must not launch the expired minute captured before that read.
			const now = Date.now();
			for (const row of rows) {
				if (this.state !== 'started' || this.pending.has(row.spaceId)) continue;
				// Retain each original completion independently. A slow room only skips its own later ticks.
				const attempt = this.attempt(row, now)
					.catch((cause: unknown) =>
						this.logger.error(
							'Schedule completion unavailable',
							cause instanceof Error ? cause : 'Unknown scheduling failure',
						),
					)
					.finally(() => {
						if (this.pending.get(row.spaceId) === attempt) this.pending.delete(row.spaceId);
					});
				this.pending.set(row.spaceId, attempt);
				attempts.push(attempt);
			}
		} catch (cause) {
			this.logger.error(`Schedule cycle unavailable: ${String(cause)}`);
		}
		return { attempts };
	}

	private async attempt(row: SpaceModeScheduleEntity, now: number): Promise<void> {
		let admission: ScheduledActivityAdmission | null = null;
		let occurrence: ScheduleOccurrence | null = null;
		const epoch = this.epoch;
		try {
			const minute = Math.floor(now / MINUTE_MS) * MINUTE_MS;
			if (row.cursor !== null && row.cursor >= minute) return;
			const plan = evaluateSchedule(row.entries, this.schedules.resolveTimezone(row), now);
			occurrence = plan.current && Date.parse(plan.current.occurs_at) === minute ? plan.current : null;
			if (occurrence && row.seenOccurrences[occurrence.entry_id] === scheduleOccurrenceKey(occurrence))
				occurrence = null;
			admission = await this.database.transaction(async (manager) => {
				const prior = occurrence
					? await manager.getRepository(SpaceActivityStateEntity).findOneBy({ spaceId: row.spaceId })
					: null;
				const occurrenceId = occurrence ? randomUUID() : null;
				const changes = occurrence
					? {
							cursor: minute,
							pendingOccurrenceId: occurrenceId,
							lastOccurrence: occurrence,
							lastAttemptStatus: 'claimed' as const,
							lastTriggerPriorActivationId: prior?.activationId ?? null,
							seenOccurrences: { ...row.seenOccurrences, [occurrence.entry_id]: scheduleOccurrenceKey(occurrence) },
						}
					: { cursor: minute };
				const updated = await manager
					.getRepository(SpaceModeScheduleEntity)
					.createQueryBuilder()
					.update()
					.set(changes)
					.where('id = :id AND revision = :revision AND enabled = 1', { id: row.id, revision: row.revision })
					.andWhere('cursor IS :cursor', { cursor: row.cursor })
					.execute();
				if (updated.affected !== 1 || !occurrence) return null;
				return {
					scheduleId: row.id,
					revision: row.revision,
					occurrenceId,
					occursAt: minute,
					previousActivationId: prior?.activationId ?? null,
					isCurrent: () =>
						this.state === 'started' &&
						epoch !== null &&
						this.epoch === epoch &&
						this.ownsRegisteredJob() &&
						this.job?.isActive === true,
				};
			});
			if (!admission || !occurrence) return;
			if (this.state !== 'started') throw new ConflictException('Scheduler stopped before activation admission');
			const modes = await this.modes.getAvailableModes(row.spaceId);
			const config = modes.find((mode) => mode.activityMode === occurrence.mode);
			if (!config?.activityEnabled) throw new ConflictException('Scheduled activity mode is disabled or missing');
			await this.modes.activateMode(
				row.spaceId,
				occurrence.mode,
				config.activityRevision,
				`schedule:${row.id}:${admission.occurrenceId}`,
				admission,
			);
		} catch (cause) {
			if (admission) {
				await this.database
					.getRepository(SpaceModeScheduleEntity)
					.update(
						{ id: row.id, pendingOccurrenceId: admission.occurrenceId },
						{ lastAttemptStatus: cause instanceof ConflictException ? 'conflict' : 'failed' },
					);
			}
			this.logger.warn(`Schedule trigger unavailable for space ${row.spaceId}: ${String(cause)}`);
		} finally {
			if (admission) this.events.emit(SPACE_SCHEDULE_CHANGED, { space_id: row.spaceId });
		}
	}

	async getScheduleState(spaceId: string): Promise<SpaceModeScheduleStateModel> {
		const row = await this.schedules.get(spaceId);
		const state = await this.modes.getActiveMode(spaceId);
		let timezone: string | null = null;
		let plan = { current: null, next: null } as ReturnType<typeof evaluateSchedule>;
		let status =
			this.state === 'started'
				? (await this.isHealthy())
					? ScheduleRuntimeStatus.RUNNING
					: ScheduleRuntimeStatus.UNAVAILABLE
				: ScheduleRuntimeStatus.STOPPED;
		const now = Date.now();
		try {
			timezone = this.schedules.resolveTimezone(row);
			if (row.enabled) plan = evaluateSchedule(row.entries, timezone, now);
			if (row.cursor !== null && row.cursor > Math.floor(now / MINUTE_MS) * MINUTE_MS)
				status = ScheduleRuntimeStatus.CLOCK_UNCERTAIN;
		} catch {
			status = ScheduleRuntimeStatus.UNAVAILABLE;
		}
		if (!row.enabled) status = ScheduleRuntimeStatus.STOPPED;
		const manual =
			row.enabled &&
			!!state &&
			!state.activityActor?.startsWith('schedule:') &&
			(!row.lastOccurrence ||
				state.activationId !== row.lastTriggerPriorActivationId ||
				(state.activityRequestedAt !== null &&
					new Date(state.activityRequestedAt).getTime() >= Date.parse(row.lastOccurrence.occurs_at)));
		return Object.assign(new SpaceModeScheduleStateModel(), {
			space_id: spaceId,
			enabled: row.enabled,
			timezone,
			status,
			...plan,
			manual_override: manual,
			last_attempt: row.lastOccurrence,
			last_attempt_status: row.lastAttemptStatus,
		});
	}
}
