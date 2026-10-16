import { DataSource, EntityManager } from 'typeorm';

import {
	ConflictException,
	Injectable,
	NotFoundException,
	OnModuleInit,
	UnprocessableEntityException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { SpaceLifecycleRegistryService } from '../../../modules/spaces/services/space-lifecycle-registry.service';
import { SpaceType } from '../../../modules/spaces/spaces.constants';
import {
	ACTIVITY_CONFIG_CHANGED,
	ACTIVITY_STATE_CHANGED,
	ActivityActivationStatus,
	ActivityMode,
} from '../activity/space-activity.constants';
import { defaultActivityConfiguration } from '../activity/space-activity.defaults';
import { validateActivityConfiguration } from '../activity/validate-activity-configuration';
import { UpdateActivityModeDto } from '../dto/activity-mode.dto';
import { SpaceActivityConfigEntity } from '../entities/space-activity-config.entity';
import { SpaceActivityStateEntity } from '../entities/space-activity-state.entity';

@Injectable()
export class SpaceActivityConfigService implements OnModuleInit {
	constructor(
		private readonly dataSource: DataSource,
		private readonly lifecycle: SpaceLifecycleRegistryService,
		private readonly events: EventEmitter2,
	) {}
	onModuleInit(): void {
		this.lifecycle.register(this);
	}
	async assertSupported(spaceId: string): Promise<SpaceEntity> {
		const space = await this.dataSource.getRepository(SpaceEntity).findOneBy({ id: spaceId });
		if (!space) throw new NotFoundException('Space not found');
		if (![SpaceType.ROOM, SpaceType.ZONE].includes(space.type))
			throw new UnprocessableEntityException('Activity modes support rooms and zones only');
		return space;
	}
	async reconcile(space: SpaceEntity, manager: EntityManager): Promise<void> {
		if (![SpaceType.ROOM, SpaceType.ZONE].includes(space.type)) {
			await manager.delete(SpaceActivityConfigEntity, { spaceId: space.id });
			await manager.delete(SpaceActivityStateEntity, { spaceId: space.id });
			return;
		}
		for (const [order, mode] of Object.values(ActivityMode).entries()) {
			const repository = manager.getRepository(SpaceActivityConfigEntity);
			if (await repository.findOneBy({ spaceId: space.id, activityMode: mode })) continue;
			await repository.save(
				repository.create({
					spaceId: space.id,
					activityMode: mode,
					activityEnabled: true,
					activityOrder: order,
					activityRevision: 1,
					activityConfiguration: defaultActivityConfiguration(mode),
				}),
			);
		}
	}
	async list(spaceId: string): Promise<SpaceActivityConfigEntity[]> {
		await this.assertSupported(spaceId);
		return this.dataSource
			.getRepository(SpaceActivityConfigEntity)
			.find({ where: { spaceId }, order: { activityOrder: 'ASC', activityMode: 'ASC' } });
	}
	async get(spaceId: string, mode: ActivityMode): Promise<SpaceActivityConfigEntity> {
		await this.assertSupported(spaceId);
		const config = await this.dataSource
			.getRepository(SpaceActivityConfigEntity)
			.findOneBy({ spaceId, activityMode: mode });
		if (!config) throw new NotFoundException('Activity configuration not found');
		return config;
	}
	async update(spaceId: string, mode: ActivityMode, dto: UpdateActivityModeDto): Promise<SpaceActivityConfigEntity> {
		const config = await this.get(spaceId, mode);
		const configuration = await validateActivityConfiguration(dto.configuration);
		const result = await this.dataSource.getRepository(SpaceActivityConfigEntity).update(
			{ id: config.id, spaceId, activityRevision: dto.expected_revision },
			{
				activityEnabled: dto.enabled,
				activityOrder: dto.display_order,
				activityConfiguration: configuration,
				activityRevision: dto.expected_revision + 1,
			},
		);
		if (result.affected !== 1) throw new ConflictException('Activity configuration revision changed');
		// Completion independently checks the configuration revision in its SQL fence. No I/O transaction is held.
		await this.dataSource
			.getRepository(SpaceActivityStateEntity)
			.createQueryBuilder()
			.update()
			.set({ activityStatus: ActivityActivationStatus.INTERRUPTED })
			.where(
				'spaceId = :spaceId AND selectedActivityMode = :mode AND selectedActivityRevision <= :revision AND activityStatus = :activating',
				{
					spaceId,
					mode,
					revision: dto.expected_revision,
					activating: ActivityActivationStatus.ACTIVATING,
				},
			)
			.execute();
		const fresh = await this.get(spaceId, mode);
		this.events.emit(ACTIVITY_CONFIG_CHANGED, { space_id: spaceId, mode, revision: fresh.activityRevision });
		const state = await this.dataSource.getRepository(SpaceActivityStateEntity).findOneBy({ spaceId });
		if (state)
			this.events.emit(ACTIVITY_STATE_CHANGED, {
				space_id: spaceId,
				activation_id: state.activationId,
				configuration_revision: state.selectedActivityRevision,
			});
		return fresh;
	}
	async reset(spaceId: string, mode: ActivityMode, expectedRevision: number): Promise<SpaceActivityConfigEntity> {
		const order = Object.values(ActivityMode).indexOf(mode);
		return this.update(spaceId, mode, {
			expected_revision: expectedRevision,
			enabled: true,
			display_order: order,
			configuration: defaultActivityConfiguration(mode),
		});
	}
}
