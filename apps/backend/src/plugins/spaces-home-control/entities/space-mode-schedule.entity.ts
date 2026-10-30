import { Exclude, Expose, Type } from 'class-transformer';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { ScheduleEntryModel, ScheduleOccurrenceModel } from '../models/space-mode-schedule.model';
import { SPACE_SCHEDULE_TABLE, ScheduleAttemptStatus } from '../schedule/space-mode-schedule.types';

@ApiSchema({ name: 'SpacesHomeControlPluginDataSpaceModeScheduleEntity' })
@Entity(SPACE_SCHEDULE_TABLE)
@Index('UQ_space_mode_schedule_space', ['spaceId'], { unique: true })
@Index('IDX_space_mode_schedule_enabled', ['enabled'])
export class SpaceModeScheduleEntity extends BaseEntity {
	@ApiProperty({ name: 'space_id', description: 'Owning room or zone', type: 'string', format: 'uuid' })
	@Expose({ name: 'space_id' })
	@Column({ type: 'varchar' })
	spaceId: string;

	@Exclude()
	@ManyToOne(() => SpaceEntity, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'spaceId', foreignKeyConstraintName: 'FK_space_mode_schedule_space' })
	space: SpaceEntity;

	@ApiProperty({ description: 'Configuration compare-and-swap revision', type: 'integer', minimum: 1 })
	@Expose()
	@Column({ type: 'integer', default: 1 })
	revision: number;

	@ApiProperty({ description: 'Scheduling is opt-in per space', type: 'boolean' })
	@Expose()
	@Column({ type: 'boolean', default: false })
	enabled: boolean;

	@ApiProperty({
		description: 'IANA timezone override; null follows the house setting',
		type: 'string',
		nullable: true,
	})
	@Expose()
	@Column({ type: 'varchar', nullable: true })
	timezone: string | null;

	@ApiProperty({
		description: 'At most 64 authored weekly entries',
		type: () => ScheduleEntryModel,
		isArray: true,
		maxItems: 64,
	})
	@Expose()
	@Type(() => ScheduleEntryModel)
	@Column({ type: 'simple-json', default: '[]' })
	entries: ScheduleEntryModel[];

	/** Durable monotonic UTC-minute watermark. It is never reset by editing or disabling a plan. */
	@Exclude()
	@Column({ type: 'integer', nullable: true })
	cursor: number | null;

	/** One last local occurrence per retained entry; bounded by the configuration's 64 entries. */
	@Exclude()
	@Column({ type: 'simple-json', default: '{}' })
	seenOccurrences: Record<string, string>;

	@Exclude()
	@Column({ type: 'varchar', nullable: true })
	pendingOccurrenceId: string | null;

	@Exclude()
	@Column({ type: 'simple-json', nullable: true })
	lastOccurrence: ScheduleOccurrenceModel | null;

	@Exclude()
	@Column({ type: 'varchar', nullable: true })
	lastAttemptStatus: ScheduleAttemptStatus | null;

	@Exclude()
	@Column({ type: 'varchar', nullable: true })
	lastTriggerPriorActivationId: string | null;

	@Exclude()
	@Column({ type: 'varchar', nullable: true })
	lastScheduledActivationId: string | null;
}
