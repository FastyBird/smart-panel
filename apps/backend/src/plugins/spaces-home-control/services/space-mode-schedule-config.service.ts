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

import { ConfigService } from '../../../modules/config/services/config.service';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { SpaceLifecycleRegistryService } from '../../../modules/spaces/services/space-lifecycle-registry.service';
import { SpaceType } from '../../../modules/spaces/spaces.constants';
import { getConfigTimezone } from '../../../modules/system/utils/timezone.utils';
import { UpdateSpaceModeScheduleDto } from '../dto/space-mode-schedule.dto';
import { SpaceModeScheduleEntity } from '../entities/space-mode-schedule.entity';
import { MINUTE_MS, isScheduleTimezone } from '../schedule/schedule-time';
import { MAX_SPACE_SCHEDULE_ENTRIES, SPACE_SCHEDULE_CHANGED } from '../schedule/space-mode-schedule.types';

import { SpaceActivityConfigService } from './space-activity-config.service';

@Injectable()
export class SpaceModeScheduleConfigService implements OnModuleInit, OnModuleDestroy {
	private unregister?: () => void;
	constructor(
		private readonly database: DataSource,
		private readonly activities: SpaceActivityConfigService,
		private readonly lifecycle: SpaceLifecycleRegistryService,
		private readonly config: ConfigService,
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
		const repository = manager.getRepository(SpaceModeScheduleEntity);
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
				timezone: null,
				entries: [],
				seenOccurrences: {},
			});
	}

	async get(spaceId: string): Promise<SpaceModeScheduleEntity> {
		await this.activities.assertSupported(spaceId);
		const row = await this.database.getRepository(SpaceModeScheduleEntity).findOneBy({ spaceId });
		if (!row) throw new NotFoundException('Space schedule configuration not found');
		return row;
	}

	resolveTimezone(row: Pick<SpaceModeScheduleEntity, 'timezone'>): string {
		const timezone = row.timezone ?? getConfigTimezone(this.config);
		if (!isScheduleTimezone(timezone)) throw new UnprocessableEntityException('Invalid schedule timezone');
		return timezone;
	}

	async update(spaceId: string, dto: UpdateSpaceModeScheduleDto): Promise<SpaceModeScheduleEntity> {
		const before = await this.get(spaceId);
		if (before.revision !== dto.expected_revision) throw new ConflictException('Schedule revision changed');
		this.resolveTimezone({ timezone: dto.timezone ?? null });
		if (dto.entries.length > MAX_SPACE_SCHEDULE_ENTRIES)
			throw new UnprocessableEntityException('Too many schedule entries');
		const ids = new Set<string>();
		const occupied = new Set<string>();
		for (const entry of dto.entries) {
			if (ids.has(entry.id)) throw new UnprocessableEntityException('Duplicate schedule entry identity');
			ids.add(entry.id);
			if (!entry.enabled) continue;
			for (const day of entry.days_of_week) {
				const slot = `${day}|${entry.time}`;
				if (occupied.has(slot))
					throw new UnprocessableEntityException('Two enabled entries share the same local trigger time');
				occupied.add(slot);
			}
		}
		// Copy public values once. Runtime fields and occurrence history are never supplied by clients.
		const entries = dto.entries.map((entry) => ({
			id: entry.id,
			mode: entry.mode,
			time: entry.time,
			days_of_week: [...entry.days_of_week].sort(),
			enabled: entry.enabled,
		}));
		await this.database.transaction(async (manager) => {
			const repository = manager.getRepository(SpaceModeScheduleEntity);
			const row = await repository.findOneBy({ id: before.id, spaceId, revision: dto.expected_revision });
			if (!row) throw new ConflictException('Schedule revision changed');
			const minute = Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;
			const seen = Object.fromEntries(Object.entries(row.seenOccurrences).filter(([id]) => ids.has(id)));
			const saved = await repository.update(
				{ id: row.id, revision: dto.expected_revision },
				{
					revision: dto.expected_revision + 1,
					enabled: dto.enabled,
					timezone: dto.timezone ?? null,
					entries,
					cursor: Math.max(row.cursor ?? minute, minute),
					seenOccurrences: seen,
					pendingOccurrenceId: null,
					lastAttemptStatus: row.lastAttemptStatus === 'claimed' ? 'interrupted' : row.lastAttemptStatus,
				},
			);
			if (saved.affected !== 1) throw new ConflictException('Schedule revision changed');
		});
		this.events.emit(SPACE_SCHEDULE_CHANGED, { space_id: spaceId });
		return this.get(spaceId);
	}
}
