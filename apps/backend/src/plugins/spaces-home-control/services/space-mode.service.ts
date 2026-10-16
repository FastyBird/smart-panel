import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

import { ConflictException, Injectable, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

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
import { ActivityDomainResultModel } from '../models/activity-result.model';

import { SpaceActivityConfigService } from './space-activity-config.service';
import { SpaceActivityDomainsService } from './space-activity-domains.service';
import { SpaceActivationIdentity } from './space-climate-automation.port';

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
	): Promise<SpaceActivityStateEntity | null> {
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
			if (prior) {
				const started = await repository
					.createQueryBuilder()
					.update()
					.set(values)
					.where('id = :id', { id: prior.id })
					.andWhere(
						'EXISTS (SELECT 1 FROM spaces_module_space_roles c WHERE c.id = :configId AND c.activityRevision = :revision AND c.activityEnabled = 1)',
						{ configId: config.id, revision },
					)
					.execute();
				if (started.affected !== 1) throw new ConflictException('Activity configuration changed');
			} else {
				// Lifecycle FK + uniqueness prevents resurrecting removed spaces or creating multiple active rows.
				await repository.save(repository.create({ spaceId, ...values }));
			}
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
			this.emit(spaceId, activationId, revision);
			const results = await Promise.all(
				Object.values(ActivityDomain).map((domain) =>
					this.domains.run(domain, config.activityConfiguration, identity, spaceId),
				),
			);
			const completed = await repository
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
			if (completed.affected === 1) this.emit(spaceId, activationId, revision);
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
	async deactivateMode(spaceId: string, activationId: string, actor: string): Promise<SpaceActivityStateEntity | null> {
		await this.configs.assertSupported(spaceId);
		const repository = this.dataSource.getRepository(SpaceActivityStateEntity);
		const result = await repository.update(
			{ spaceId, activationId },
			{
				selectedActivityMode: null,
				activationId: randomUUID(),
				activityStatus: ActivityActivationStatus.DEACTIVATED,
				activityActor: actor,
				activityResults: [],
			},
		);
		if (result.affected !== 1) throw new ConflictException('Activity activation identity changed');
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
