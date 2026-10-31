import { Exclude, Expose } from 'class-transformer';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { ActivityMode } from '../activity/space-activity.constants';
import { OccupancyStatus, SPACE_OCCUPANCY_TABLE } from '../occupancy/space-occupancy.types';

@ApiSchema({ name: 'SpacesHomeControlPluginDataOccupancyConfiguration' })
@Entity(SPACE_OCCUPANCY_TABLE)
@Index('UQ_space_occupancy_space', ['spaceId'], { unique: true })
export class SpaceOccupancyEntity extends BaseEntity {
	@ApiProperty({ name: 'space_id', type: 'string', format: 'uuid' })
	@Expose({ name: 'space_id' })
	@Column({ type: 'varchar' })
	spaceId: string;

	@Exclude()
	@ManyToOne(() => SpaceEntity, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'spaceId', foreignKeyConstraintName: 'FK_space_occupancy_space' })
	space: SpaceEntity;

	@ApiProperty({ type: 'integer', minimum: 1 })
	@Expose()
	@Column({ type: 'integer', default: 1 })
	revision: number;

	@ApiProperty({ type: 'boolean', description: 'Explicit opt-in; initially disabled' })
	@Expose()
	@Column({ type: 'boolean', default: false })
	enabled: boolean;

	@ApiProperty({ name: 'vacancy_timeout_seconds', type: 'integer', minimum: 30, maximum: 86400, default: 900 })
	@Expose({ name: 'vacancy_timeout_seconds' })
	@Column({ type: 'integer', default: 900 })
	vacancyTimeoutSeconds: number;

	@ApiProperty({ name: 'maximum_age_seconds', type: 'integer', minimum: 30, maximum: 86400, default: 3600 })
	@Expose({ name: 'maximum_age_seconds' })
	@Column({ type: 'integer', default: 3600 })
	maximumAgeSeconds: number;

	@ApiProperty({
		name: 'sensor_property_ids',
		type: [String],
		maxItems: 32,
		description: 'Explicit DETECTED properties from motion or occupancy channels belonging to this space',
	})
	@Expose({ name: 'sensor_property_ids' })
	@Column({ type: 'simple-json', default: '[]' })
	sensorPropertyIds: string[];

	@ApiProperty({
		name: 'occupied_mode',
		anyOf: [{ type: 'string', enum: Object.values(ActivityMode) }, { type: 'null' }],
		description: 'Null restores the previous selection owned by the vacancy transition',
	})
	@Expose({ name: 'occupied_mode' })
	@Column({ type: 'varchar', nullable: true })
	occupiedMode: ActivityMode | null;

	@ApiProperty({
		name: 'vacant_mode',
		anyOf: [{ type: 'string', enum: Object.values(ActivityMode) }, { type: 'null' }],
		description: 'Null changes no mode',
	})
	@Expose({ name: 'vacant_mode' })
	@Column({ type: 'varchar', nullable: true })
	vacantMode: ActivityMode | null;

	@Exclude()
	@Column({ type: 'varchar', default: OccupancyStatus.UNKNOWN })
	status: OccupancyStatus;

	@Exclude()
	@Column({ type: 'varchar', nullable: true })
	transitionId: string | null;

	@Exclude()
	@Column({ type: 'boolean', default: false })
	manualOverride: boolean;

	@Exclude()
	@Column({ type: 'varchar', nullable: true })
	lastAutomaticActivationId: string | null;

	@Exclude()
	@Column({ type: 'varchar', nullable: true })
	actedTransitionId: string | null;

	@Exclude()
	@Column({ type: 'varchar', nullable: true })
	previousMode: ActivityMode | null;

	@Exclude()
	@Column({ type: 'boolean', default: false })
	previousCaptured: boolean;

	@Exclude()
	@Column({ type: 'varchar', nullable: true })
	lastAttemptStatus: string | null;
}
