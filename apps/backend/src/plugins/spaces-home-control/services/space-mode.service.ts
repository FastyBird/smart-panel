import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';

import { ConflictException, Injectable, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { captureSqliteNoMutationWindow, registerSqliteCommitGuard } from '../../../common/database/sqlite-data-source';
import { getEnvValue } from '../../../common/utils/config.utils';
import { activationStatus } from '../activity/activity-result.utils';
import {
	ACTIVITY_STATE_CHANGED,
	ActivityActivationStatus,
	ActivityDomain,
	ActivityMode,
} from '../activity/space-activity.constants';
import { SpaceActivityConfigEntity } from '../entities/space-activity-config.entity';
import { SpaceActivityStateEntity } from '../entities/space-activity-state.entity';
import { SpaceModeScheduleEntity } from '../entities/space-mode-schedule.entity';
import { ActivityDomainResultModel } from '../models/activity-result.model';
import { claimOccupancy, prepareOccupancyValidation } from '../occupancy/occupancy-admission';
import { OccupancyActivityAdmission } from '../occupancy/space-occupancy.types';
import { MINUTE_MS } from '../schedule/schedule-time';
import { ScheduledActivityAdmission } from '../schedule/space-mode-schedule.types';

import { SpaceActivityConfigService } from './space-activity-config.service';
import { SpaceActivityDomainsService } from './space-activity-domains.service';
import { SpaceActivationIdentity } from './space-climate-automation.port';
import { SpaceClimateAutomationService } from './space-climate-automation.service';
import { SpaceOccupancyConfigService } from './space-occupancy-config.service';

@Injectable()
export class SpaceModeService implements OnApplicationBootstrap {
	/** No waiting list: a second request is rejected while any domain I/O is still running. */
	private readonly running = new Set<string>();
	constructor(
		private readonly dataSource: DataSource,
		private readonly configs: SpaceActivityConfigService,
		private readonly domains: SpaceActivityDomainsService,
		private readonly events: EventEmitter2,
		@Optional() private readonly configService: NestConfigService = new NestConfigService(),
		@Optional() private readonly climateAutomation?: SpaceClimateAutomationService,
		@Optional() private readonly occupancyConfigs?: SpaceOccupancyConfigService,
	) {}
	async onApplicationBootstrap(): Promise<void> {
		if (getEnvValue<string>(this.configService, 'FB_CLI', null) === 'on') return;
		// A process crash is not proof of completed actuation. Never replay startup plans.
		await this.dataSource
			.getRepository(SpaceActivityStateEntity)
			.update(
				{ activityStatus: ActivityActivationStatus.ACTIVATING },
				{ activityStatus: ActivityActivationStatus.INTERRUPTED },
			);
	}
	getAvailableModes(spaceId: string): Promise<SpaceActivityConfigEntity[]> {
		return this.configs.list(spaceId);
	}
	async getActiveMode(spaceId: string): Promise<SpaceActivityStateEntity | null> {
		await this.configs.assertSupported(spaceId);
		return this.dataSource.getRepository(SpaceActivityStateEntity).findOneBy({ spaceId });
	}
	private async checkedConfig(
		spaceId: string,
		mode: ActivityMode,
		revision: number,
	): Promise<SpaceActivityConfigEntity> {
		const config = await this.configs.get(spaceId, mode);
		if (!config.activityEnabled) throw new ConflictException('Activity mode is disabled');
		if (config.activityRevision !== revision) throw new ConflictException('Activity configuration revision changed');
		return config;
	}
	async preview(spaceId: string, mode: ActivityMode, revision: number): Promise<ActivityDomainResultModel[]> {
		const config = await this.checkedConfig(spaceId, mode, revision);
		return Promise.all(
			Object.values(ActivityDomain).map((domain) =>
				this.domains.run(domain, config.activityConfiguration, null, spaceId),
			),
		);
	}
	async activateMode(
		spaceId: string,
		mode: ActivityMode,
		revision: number,
		actor: string,
		scheduledAdmission?: ScheduledActivityAdmission,
		occupancyAdmission?: OccupancyActivityAdmission,
	): Promise<SpaceActivityStateEntity | null> {
		const scheduled = scheduledAdmission ? Object.freeze({ ...scheduledAdmission }) : null;
		const occupancy = occupancyAdmission ? Object.freeze({ ...occupancyAdmission }) : null;
		if (scheduled && occupancy) throw new ConflictException('Only one automatic activity source may be admitted');
		if (this.running.has(spaceId))
			throw new ConflictException('Space activity activation is in progress; retry after completion');
		this.running.add(spaceId);
		try {
			const config = await this.checkedConfig(spaceId, mode, revision);
			const repository = this.dataSource.getRepository(SpaceActivityStateEntity);
			const prior = await repository.findOneBy({ spaceId });
			const activationId = randomUUID();
			// One conditional INSERT/UPDATE starts the activation only while the selected config still exists at this revision.
			const values = {
				selectedActivityMode: mode,
				activationId,
				selectedActivityRevision: revision,
				activityStatus: ActivityActivationStatus.ACTIVATING,
				activityActor: actor,
				activityResults: [],
			};
			const prepareScheduledValidation = scheduled
				? (manager: EntityManager) => {
						const nativeWindow = captureSqliteNoMutationWindow(
							manager,
							() =>
								scheduled.isCurrent() &&
								Date.now() >= scheduled.occursAt &&
								Date.now() < scheduled.occursAt + MINUTE_MS,
						);
						return async () => {
							// Every required write has settled. Final evidence reads and COMMIT may not issue new DML.
							nativeWindow.beginFinalValidation();
							const admitted = await manager.query<{ id: string }[]>(
								`
						SELECT s.id FROM spaces_home_control_mode_schedules s
						JOIN spaces_module_spaces p ON p.id = s.spaceId
						JOIN spaces_module_space_roles c ON c.id = ? AND c.spaceId = s.spaceId
						JOIN spaces_module_space_roles a ON a.spaceId = s.spaceId AND a.activationId = ?
						WHERE s.id = ? AND s.spaceId = ? AND s.revision = ? AND s.enabled = 1
						AND s.pendingOccurrenceId = ? AND s.lastScheduledActivationId = ?
						AND s.lastTriggerPriorActivationId IS ? AND s.lastAttemptStatus = 'started'
						AND a.selectedActivityMode = ? AND a.selectedActivityRevision = ? AND a.activityStatus = 'activating' AND a.activityActor = ?
						AND c.activityRevision = ? AND c.activityEnabled = 1 AND p.type IN ('room','zone')`,
								[
									config.id,
									activationId,
									scheduled.scheduleId,
									spaceId,
									scheduled.revision,
									scheduled.occurrenceId,
									activationId,
									scheduled.previousActivationId,
									mode,
									revision,
									actor,
									revision,
								],
							);
							if (admitted.length !== 1) throw new ConflictException('Scheduled admission changed before COMMIT');
							nativeWindow.applied();
						};
					}
				: undefined;
			const prepareValidation = occupancy
				? prepareOccupancyValidation(occupancy, activationId, spaceId, { id: config.id, revision })
				: prepareScheduledValidation;
			const start = async (manager: EntityManager) => {
				if (occupancy) {
					if ((prior?.activationId ?? null) !== occupancy.previousActivationId)
						throw new ConflictException('A newer activity superseded occupancy');
					await claimOccupancy(manager, occupancy, activationId);
				} else if (!scheduled) await this.occupancyConfigs?.markManual(manager, spaceId);
				const currentRepository = manager.getRepository(SpaceActivityStateEntity);
				const admittedValues = { ...values, activityRequestedAt: new Date() };
				const checkScheduledTime = () => {
					if (!scheduled) return;
					const now = Date.now();
					if (!scheduled.isCurrent() || now < scheduled.occursAt || now >= scheduled.occursAt + MINUTE_MS)
						throw new ConflictException('Scheduled occurrence is no longer current');
				};
				if (scheduled) {
					checkScheduledTime();
					registerSqliteCommitGuard(
						manager,
						() =>
							scheduled.isCurrent() && Date.now() >= scheduled.occursAt && Date.now() < scheduled.occursAt + MINUTE_MS,
					);
					if ((prior?.activationId ?? null) !== scheduled.previousActivationId)
						throw new ConflictException('A newer activity request superseded this scheduled occurrence');
					if (prior?.activityRequestedAt && new Date(prior.activityRequestedAt).getTime() >= scheduled.occursAt)
						throw new ConflictException('A newer activity request superseded this scheduled occurrence');
					const accepted = await manager
						.getRepository(SpaceModeScheduleEntity)
						.createQueryBuilder()
						.update()
						.set({ lastScheduledActivationId: activationId, lastAttemptStatus: 'started' })
						.where(
							'id = :id AND spaceId = :spaceId AND revision = :revision AND enabled = 1 AND pendingOccurrenceId = :occurrence',
							{ id: scheduled.scheduleId, spaceId, revision: scheduled.revision, occurrence: scheduled.occurrenceId },
						)
						.andWhere('lastTriggerPriorActivationId IS :previous', { previous: scheduled.previousActivationId })
						.execute();
					if (accepted.affected !== 1) throw new ConflictException('Scheduled configuration or occurrence changed');
					checkScheduledTime();
				}
				if (prior) {
					const query = currentRepository
						.createQueryBuilder()
						.update()
						.set(admittedValues)
						.where('id = :id', { id: prior.id })
						.andWhere(
							'EXISTS (SELECT 1 FROM spaces_module_space_roles c WHERE c.id = :configId AND c.activityRevision = :revision AND c.activityEnabled = 1)',
							{ configId: config.id, revision },
						);
					if (scheduled || occupancy)
						query.andWhere('activationId IS :previousActivation', {
							previousActivation: (scheduled ?? occupancy).previousActivationId,
						});
					const started = await query.execute();
					if (started.affected !== 1) throw new ConflictException('Activity configuration changed');
				} else {
					// Lifecycle FK + uniqueness prevents resurrecting removed spaces or creating multiple active rows.
					await currentRepository.save(currentRepository.create({ spaceId, ...admittedValues }));
				}
			};
			if (this.climateAutomation)
				await this.climateAutomation.mutate(spaceId, undefined, start, undefined, prepareValidation);
			else if (prepareValidation || this.occupancyConfigs)
				await this.dataSource.transaction(async (manager) => {
					const validate = prepareValidation?.(manager);
					await start(manager);
					await validate?.();
				});
			else await start(this.dataSource.manager);
			const identity: SpaceActivationIdentity = {
				spaceId,
				activationId,
				configurationRevision: revision,
				isCurrent: () => this.isCurrent(spaceId, activationId, config.id, revision),
			};
			if (!(await identity.isCurrent())) {
				await repository.update({ spaceId, activationId }, { activityStatus: ActivityActivationStatus.INTERRUPTED });
				throw new ConflictException('Activity configuration changed before execution');
			}
			const completion = this.climateAutomation?.captureCompletion(identity);
			this.emit(spaceId, activationId, revision);
			const results = await Promise.all(
				Object.values(ActivityDomain).map((domain) =>
					this.domains.run(domain, config.activityConfiguration, identity, spaceId),
				),
			);
			const write = async (manager: EntityManager) => {
				const completed = await manager
					.getRepository(SpaceActivityStateEntity)
					.createQueryBuilder()
					.update()
					.set({ activityStatus: activationStatus(results), activityResults: results })
					.where('spaceId = :spaceId AND activationId = :activationId AND activityStatus = :status', {
						spaceId,
						activationId,
						status: ActivityActivationStatus.ACTIVATING,
					})
					.andWhere(
						'EXISTS (SELECT 1 FROM spaces_module_space_roles c WHERE c.id = :configId AND c.activityRevision = :revision AND c.activityEnabled = 1)',
						{ configId: config.id, revision },
					)
					.execute();
				return completed.affected === 1;
			};
			const completed = completion ? await completion(results, write) : await write(this.dataSource.manager);
			if (completed) this.emit(spaceId, activationId, revision);
			// Return current state, even if deactivation/config changes won the race. Never save the stale entity again.
			return repository.findOneBy({ spaceId });
		} finally {
			this.running.delete(spaceId);
		}
	}
	private async isCurrent(spaceId: string, activationId: string, configId: string, revision: number): Promise<boolean> {
		const rows = await this.dataSource.query<unknown[]>(
			`SELECT 1 FROM spaces_module_space_roles s JOIN spaces_module_space_roles c ON c.spaceId = s.spaceId WHERE s.type = 'activity_state' AND s.spaceId = ? AND s.activationId = ? AND s.activityStatus = ? AND c.type = 'activity_config' AND c.id = ? AND c.activityRevision = ? AND c.activityEnabled = 1`,
			[spaceId, activationId, ActivityActivationStatus.ACTIVATING, configId, revision],
		);
		return rows.length === 1;
	}
	async deactivateMode(
		spaceId: string,
		activationId: string,
		actor: string,
		occupancy?: OccupancyActivityAdmission,
	): Promise<SpaceActivityStateEntity | null> {
		await this.configs.assertSupported(spaceId);
		const repository = this.dataSource.getRepository(SpaceActivityStateEntity);
		const nextActivation = randomUUID();
		const prepareValidation = occupancy ? prepareOccupancyValidation(occupancy, nextActivation, spaceId) : undefined;
		const write = async (manager: EntityManager) => {
			if (occupancy) {
				if (occupancy.previousActivationId !== activationId)
					throw new ConflictException('Occupancy restore was superseded');
				await claimOccupancy(manager, occupancy, nextActivation);
			} else await this.occupancyConfigs?.markManual(manager, spaceId);
			const result = await manager.getRepository(SpaceActivityStateEntity).update(
				{ spaceId, activationId },
				{
					selectedActivityMode: null,
					activationId: nextActivation,
					activityStatus: ActivityActivationStatus.DEACTIVATED,
					activityActor: actor,
					activityRequestedAt: new Date(),
					activityResults: [],
				},
			);
			if (result.affected !== 1) throw new ConflictException('Activity activation identity changed');
		};
		if (this.climateAutomation)
			await this.climateAutomation.mutate(spaceId, activationId, write, undefined, prepareValidation);
		else if (prepareValidation || this.occupancyConfigs)
			await this.dataSource.transaction(async (manager) => {
				const validate = prepareValidation?.(manager);
				await write(manager);
				await validate?.();
			});
		else await write(this.dataSource.manager);
		const state = await repository.findOneBy({ spaceId });
		this.emit(spaceId, state.activationId, state.selectedActivityRevision);
		return state;
	}
	private emit(spaceId: string, activationId: string, revision: number): void {
		this.events.emit(ACTIVITY_STATE_CHANGED, {
			space_id: spaceId,
			activation_id: activationId,
			configuration_revision: revision,
		});
	}
}
