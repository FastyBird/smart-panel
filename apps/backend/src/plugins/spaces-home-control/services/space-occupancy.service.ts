import { CronJob } from 'cron';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { DataSource } from 'typeorm';

import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';

import { createExtensionLogger } from '../../../common/logger';
import { EventType as DevicesEventType } from '../../../modules/devices/devices.constants';
import { BaseManagedExtensionService } from '../../../modules/extensions/services/base-managed-extension.service';
import { ACTIVITY_STATE_CHANGED } from '../activity/space-activity.constants';
import { SpaceActivityStateEntity } from '../entities/space-activity-state.entity';
import { SpaceOccupancyEntity } from '../entities/space-occupancy.entity';
import {
	OccupancyActivityAdmission,
	OccupancyMemory,
	OccupancyObservation,
	OccupancyStatus,
	SPACE_OCCUPANCY_CHANGED,
	SPACE_OCCUPANCY_MONOTONIC_CLOCK,
	advanceOccupancy,
} from '../occupancy/space-occupancy.types';
import { SPACES_HOME_CONTROL_PLUGIN_NAME } from '../spaces-home-control.constants';

import { SpaceActivityConfigService } from './space-activity-config.service';
import { SpaceModeService } from './space-mode.service';
import { SpaceOccupancyConfigService } from './space-occupancy-config.service';
import { SpaceOccupancyInputsService } from './space-occupancy-inputs.service';

const JOB = 'spaceOccupancy';
type Frame = { revision: number; memory: OccupancyMemory; observation: OccupancyObservation };

@Injectable()
export class SpaceOccupancyService extends BaseManagedExtensionService implements OnModuleDestroy {
	readonly owner = { kind: 'plugin', type: SPACES_HOME_CONTROL_PLUGIN_NAME } as const;
	readonly serviceId = 'occupancy';
	private readonly logger = createExtensionLogger(SPACES_HOME_CONTROL_PLUGIN_NAME, 'SpaceOccupancyService');
	private readonly frames = new Map<string, Frame>();
	private readonly pending = new Map<string, Promise<void>>();
	private epoch: object | null = null;
	private job: CronJob | null = null;
	private scan: Promise<void> | null = null;
	private debounce: NodeJS.Timeout | null = null;

	constructor(
		private readonly database: DataSource,
		private readonly configs: SpaceOccupancyConfigService,
		private readonly inputs: SpaceOccupancyInputsService,
		private readonly activities: SpaceActivityConfigService,
		private readonly modes: SpaceModeService,
		private readonly registry: SchedulerRegistry,
		@Optional()
		@Inject(SPACE_OCCUPANCY_MONOTONIC_CLOCK)
		private readonly monotonic: () => number = () => performance.now(),
	) {
		super();
	}

	async start(): Promise<void> {
		await this.withLock(async () => {
			if (this.state === 'started') return;
			this.state = 'starting';
			try {
				this.job = CronJob.from({
					cronTime: '*/5 * * * * *',
					onTick: () => this.scanCycle(),
					unrefTimeout: true,
					waitForCompletion: true,
				});
				this.registry.addCronJob(JOB, this.job);
				await this.database
					.getRepository(SpaceOccupancyEntity)
					.createQueryBuilder()
					.update()
					.set({ status: OccupancyStatus.UNKNOWN, transitionId: null })
					.execute();
				this.frames.clear();
				this.epoch = {};
				this.state = 'started';
				this.job.start();
			} catch (cause) {
				if (this.registry.doesExist('cron', JOB) && this.registry.getCronJob(JOB) === this.job)
					this.registry.deleteCronJob(JOB);
				this.job = null;
				this.epoch = null;
				this.state = 'error';
				throw cause;
			}
		});
	}

	async stop(): Promise<void> {
		await this.withLock(async () => {
			this.state = 'stopping';
			this.epoch = null;
			if (this.debounce) clearTimeout(this.debounce);
			this.debounce = null;
			await this.job?.stop();
			if (this.registry.doesExist('cron', JOB) && this.registry.getCronJob(JOB) === this.job)
				this.registry.deleteCronJob(JOB);
			this.job = null;
			await this.scan;
			await Promise.allSettled([...this.pending.values()]);
			this.frames.clear();
			this.state = 'stopped';
		});
	}
	onModuleDestroy(): Promise<void> {
		return this.stop();
	}
	isHealthy(): Promise<boolean> {
		return Promise.resolve(this.state === 'started' && this.job?.isActive === true);
	}

	@OnEvent(DevicesEventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED)
	@OnEvent(DevicesEventType.CHANNEL_PROPERTY_SAMPLE_INVALIDATED)
	@OnEvent(DevicesEventType.DEVICE_CONNECTION_CHANGED)
	@OnEvent(SPACE_OCCUPANCY_CHANGED)
	@OnEvent(ACTIVITY_STATE_CHANGED)
	changed(): void {
		if (!this.epoch || this.debounce) return;
		this.debounce = setTimeout(() => {
			this.debounce = null;
			void this.scanCycle();
		}, 100);
	}
	private scanCycle(): Promise<void> {
		if (!this.epoch) return Promise.resolve();
		if (this.scan !== null) return this.scan;
		this.scan = (async () => {
			const rows = await this.database.getRepository(SpaceOccupancyEntity).findBy({ enabled: true });
			const ids = new Set(rows.map((row) => row.spaceId));
			for (const id of this.frames.keys()) if (!ids.has(id)) this.frames.delete(id);
			for (const row of rows) {
				if (this.pending.has(row.spaceId)) continue;
				const task = this.evaluate(row)
					.catch((cause: unknown) => {
						this.frames.delete(row.spaceId);
						this.logger.error('Occupancy evaluation failed', cause instanceof Error ? cause : 'Unknown failure');
					})
					.finally(() => {
						if (this.pending.get(row.spaceId) === task) this.pending.delete(row.spaceId);
					});
				this.pending.set(row.spaceId, task);
			}
		})()
			.catch((cause: unknown) => {
				this.logger.error('Occupancy scan failed', cause instanceof Error ? cause : 'Unknown failure');
			})
			.finally(() => {
				this.scan = null;
			});
		return this.scan;
	}
	async runCycle(): Promise<void> {
		await this.scanCycle();
		await Promise.allSettled([...this.pending.values()]);
	}

	private async evaluate(row: SpaceOccupancyEntity): Promise<void> {
		const epoch = this.epoch;
		if (!epoch) return;
		const observation = await this.inputs.capture(row);
		if (this.epoch !== epoch) return;
		const prior = this.frames.get(row.spaceId);
		const memory = advanceOccupancy(
			prior?.revision === row.revision
				? prior.memory
				: { status: OccupancyStatus.UNKNOWN, negativeSince: null, wall: Date.now() },
			observation.status,
			Date.now(),
			this.monotonic(),
			row.vacancyTimeoutSeconds * 1000,
		);
		const frame = { revision: row.revision, memory, observation };
		this.frames.set(row.spaceId, frame);
		if (memory.status === row.status) return;
		const transitionId = randomUUID();
		const changed = await this.database
			.getRepository(SpaceOccupancyEntity)
			.createQueryBuilder()
			.update()
			.set({ status: memory.status, transitionId, lastAttemptStatus: null })
			.where('id = :id AND revision = :revision AND transitionId IS :transition AND enabled = 1', {
				id: row.id,
				revision: row.revision,
				transition: row.transitionId,
			})
			.execute();
		if (changed.affected !== 1) return;
		this.configs.changed(row.spaceId);
		if (row.manualOverride || memory.status === OccupancyStatus.UNKNOWN) return;
		const activity = await this.database.getRepository(SpaceActivityStateEntity).findOneBy({ spaceId: row.spaceId });
		let mode = memory.status === OccupancyStatus.VACANT ? row.vacantMode : row.occupiedMode;
		let restoreEmpty = false;
		if (memory.status === OccupancyStatus.VACANT && mode) {
			await this.database
				.getRepository(SpaceOccupancyEntity)
				.update(
					{ id: row.id, revision: row.revision, transitionId },
					{ previousMode: activity?.selectedActivityMode ?? null, previousCaptured: true },
				);
		} else if (
			memory.status === OccupancyStatus.OCCUPIED &&
			!mode &&
			row.previousCaptured &&
			activity?.activationId === row.lastAutomaticActivationId
		) {
			mode = row.previousMode;
			restoreEmpty = mode === null;
		}
		if (!mode && !restoreEmpty) return;
		const admission: OccupancyActivityAdmission = {
			occupancyId: row.id,
			revision: row.revision,
			transitionId,
			status: memory.status,
			previousActivationId: activity?.activationId ?? null,
			isCurrent: () =>
				this.epoch === epoch &&
				this.frames.get(row.spaceId)?.revision === row.revision &&
				this.frames.get(row.spaceId)?.memory.status === memory.status &&
				observation.isCurrent() &&
				Date.now() >= memory.wall,
		};
		try {
			if (mode) {
				const config = await this.activities.get(row.spaceId, mode);
				await this.modes.activateMode(row.spaceId, mode, config.activityRevision, 'occupancy', undefined, admission);
			} else if (activity) await this.modes.deactivateMode(row.spaceId, activity.activationId, 'occupancy', admission);
			await this.database
				.getRepository(SpaceOccupancyEntity)
				.update({ id: row.id, revision: row.revision, transitionId }, { lastAttemptStatus: 'completed' });
		} catch (cause) {
			await this.database
				.getRepository(SpaceOccupancyEntity)
				.update({ id: row.id, revision: row.revision, transitionId }, { lastAttemptStatus: 'failed' });
			this.logger.warn(
				'Occupancy activation refused or failed',
				cause instanceof Error ? cause.message : String(cause),
			);
		} finally {
			this.configs.changed(row.spaceId);
		}
	}

	async stateFor(spaceId: string) {
		const row = await this.configs.get(spaceId);
		const frame = this.frames.get(spaceId);
		const fresh =
			this.epoch &&
			row.enabled &&
			frame?.revision === row.revision &&
			Date.now() >= frame.memory.wall &&
			Date.now() - frame.memory.wall <= 15_000 &&
			frame.observation.isCurrent();
		return {
			spaceId,
			status: fresh ? row.status : OccupancyStatus.UNKNOWN,
			enabled: row.enabled,
			running: this.epoch !== null,
			manualOverride: row.manualOverride,
			vacancyRemainingSeconds:
				fresh && frame.memory.negativeSince !== null
					? Math.max(0, Math.ceil(row.vacancyTimeoutSeconds - (this.monotonic() - frame.memory.negativeSince) / 1000))
					: null,
			lastAttemptStatus: row.lastAttemptStatus,
		};
	}
}
