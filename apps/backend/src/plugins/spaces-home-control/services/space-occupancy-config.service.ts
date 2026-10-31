import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';

import {
	ConflictException,
	Injectable,
	NotFoundException,
	OnModuleDestroy,
	OnModuleInit,
	UnprocessableEntityException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { SpaceLifecycleRegistryService } from '../../../modules/spaces/services/space-lifecycle-registry.service';
import { SpaceType } from '../../../modules/spaces/spaces.constants';
import { UpdateSpaceOccupancyDto } from '../dto/space-occupancy.dto';
import { SpaceOccupancyEntity } from '../entities/space-occupancy.entity';
import { OccupancyStatus, SPACE_OCCUPANCY_CHANGED } from '../occupancy/space-occupancy.types';

import { SpaceActivityConfigService } from './space-activity-config.service';
import { SpaceOccupancyInputsService } from './space-occupancy-inputs.service';

@Injectable()
export class SpaceOccupancyConfigService implements OnModuleInit, OnModuleDestroy {
	private unregister?: () => void;
	constructor(
		private readonly database: DataSource,
		private readonly activities: SpaceActivityConfigService,
		private readonly lifecycle: SpaceLifecycleRegistryService,
		private readonly inputs: SpaceOccupancyInputsService,
		private readonly events: EventEmitter2,
	) {}
	onModuleInit(): void {
		this.unregister = this.lifecycle.register(this);
	}
	onModuleDestroy(): void {
		this.unregister?.();
		this.unregister = undefined;
	}
	async reconcile(space: SpaceEntity, manager: EntityManager): Promise<void> {
		const repository = manager.getRepository(SpaceOccupancyEntity);
		if (![SpaceType.ROOM, SpaceType.ZONE].includes(space.type)) {
			await repository.delete({ spaceId: space.id });
			return;
		}
		if (!(await repository.findOneBy({ spaceId: space.id })))
			await repository.insert({
				id: randomUUID(),
				spaceId: space.id,
				revision: 1,
				enabled: false,
				sensorPropertyIds: [],
				occupiedMode: null,
				vacantMode: null,
				status: OccupancyStatus.UNKNOWN,
			});
	}
	async get(spaceId: string): Promise<SpaceOccupancyEntity> {
		await this.activities.assertSupported(spaceId);
		const row = await this.database.getRepository(SpaceOccupancyEntity).findOneBy({ spaceId });
		if (!row) throw new NotFoundException('Space occupancy configuration not found');
		return row;
	}
	async update(spaceId: string, dto: UpdateSpaceOccupancyDto): Promise<SpaceOccupancyEntity> {
		await this.get(spaceId);
		if (dto.enabled && !dto.sensorPropertyIds.length)
			throw new UnprocessableEntityException('Select at least one occupancy sensor');
		if (dto.maximumAgeSeconds <= dto.vacancyTimeoutSeconds)
			throw new UnprocessableEntityException('Sensor maximum age must exceed the vacancy timeout');
		const available = new Set((await this.inputs.list(spaceId)).map((sensor) => sensor.propertyId));
		if (dto.sensorPropertyIds.some((id) => !available.has(id)))
			throw new UnprocessableEntityException('An occupancy sensor no longer belongs to the space');
		for (const mode of [dto.occupiedMode, dto.vacantMode]) {
			if (mode && !(await this.activities.get(spaceId, mode)).activityEnabled)
				throw new UnprocessableEntityException('Selected activity mode is disabled');
		}
		await this.database.transaction(async (manager) => {
			const result = await manager.getRepository(SpaceOccupancyEntity).update(
				{ spaceId, revision: dto.expectedRevision },
				{
					enabled: dto.enabled,
					vacancyTimeoutSeconds: dto.vacancyTimeoutSeconds,
					maximumAgeSeconds: dto.maximumAgeSeconds,
					sensorPropertyIds: [...dto.sensorPropertyIds],
					occupiedMode: dto.occupiedMode,
					vacantMode: dto.vacantMode,
					revision: dto.expectedRevision + 1,
					status: OccupancyStatus.UNKNOWN,
					transitionId: randomUUID(),
					actedTransitionId: null,
					previousMode: null,
					previousCaptured: false,
				},
			);
			if (result.affected !== 1) throw new ConflictException('Occupancy configuration revision changed');
		});
		this.changed(spaceId);
		return this.get(spaceId);
	}
	/** Enrolled in the original manual activity transaction; schedules never clear this hold. */
	async markManual(manager: EntityManager, spaceId: string): Promise<void> {
		await manager
			.getRepository(SpaceOccupancyEntity)
			.createQueryBuilder()
			.update()
			.set({ manualOverride: true, revision: () => 'revision + 1', transitionId: randomUUID() })
			.where('spaceId = :spaceId', { spaceId })
			.execute();
	}
	async clearManual(spaceId: string, expectedRevision: number): Promise<SpaceOccupancyEntity> {
		await this.get(spaceId);
		const result = await this.database.getRepository(SpaceOccupancyEntity).update(
			{ spaceId, revision: expectedRevision },
			{
				manualOverride: false,
				revision: expectedRevision + 1,
				status: OccupancyStatus.UNKNOWN,
				transitionId: randomUUID(),
				previousCaptured: false,
				previousMode: null,
			},
		);
		if (result.affected !== 1) throw new ConflictException('Occupancy configuration revision changed');
		this.changed(spaceId);
		return this.get(spaceId);
	}
	changed(spaceId: string): void {
		this.events.emit(SPACE_OCCUPANCY_CHANGED, { space_id: spaceId });
	}
}
