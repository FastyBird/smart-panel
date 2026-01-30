import { Expose, Transform } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { toSnakeCaseKeys } from '../../../common/utils/transform.utils';

import { BaseEntity } from '../../../common/entities/base.entity';
import { MediaActivationState, MediaActivityKey } from '../spaces.constants';

import { SpaceEntity } from './space.entity';

/**
 * Represents the currently active media activity for a space.
 * Only ONE active activity per space is allowed at any time.
 * Tracks activation state, resolved devices, and execution results.
 */
@ApiSchema({ name: 'SpacesModuleDataSpaceActiveMediaActivity' })
@Entity('spaces_module_active_media_activities')
@Unique(['spaceId'])
export class SpaceActiveMediaActivityEntity extends BaseEntity {
	@ApiProperty({
		name: 'space_id',
		description: 'ID of the space this active activity belongs to',
		type: 'string',
		format: 'uuid',
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose({ name: 'space_id' })
	@IsUUID('4')
	@Transform(({ obj }: { obj: { space_id?: string; spaceId?: string } }) => obj.space_id ?? obj.spaceId, {
		toClassOnly: true,
	})
	@Column({ nullable: false })
	spaceId: string;

	@ManyToOne(() => SpaceEntity, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'spaceId' })
	space: SpaceEntity;

	@ApiPropertyOptional({
		name: 'activity_key',
		description: 'The currently active activity key (null means deactivated)',
		enum: MediaActivityKey,
	})
	@Expose({ name: 'activity_key' })
	@IsOptional()
	@IsEnum(MediaActivityKey)
	@Transform(
		({ obj }: { obj: { activity_key?: string; activityKey?: string } }) => obj.activity_key ?? obj.activityKey,
		{ toClassOnly: true },
	)
	@Column({ type: 'varchar', nullable: true })
	activityKey: MediaActivityKey | null;

	@ApiProperty({
		description: 'Current state of the activity activation',
		enum: MediaActivationState,
		example: MediaActivationState.ACTIVE,
	})
	@Expose()
	@IsEnum(MediaActivationState)
	@Column({
		type: 'varchar',
		default: MediaActivationState.DEACTIVATED,
	})
	state: MediaActivationState;

	@ApiPropertyOptional({
		name: 'activated_at',
		description: 'Timestamp when the activity was activated',
		type: 'string',
		format: 'date-time',
	})
	@Expose({ name: 'activated_at' })
	@IsOptional()
	@IsDate()
	@Transform(({ obj }: { obj: { activated_at?: Date; activatedAt?: Date } }) => obj.activated_at ?? obj.activatedAt, {
		toClassOnly: true,
	})
	@Column({ type: 'datetime', nullable: true })
	activatedAt: Date | null;

	@ApiPropertyOptional({
		description: 'JSON object with resolved device IDs for each slot',
		type: 'string',
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Transform(({ value }: { value: string | null }) => {
		if (!value) return null;
		try { return toSnakeCaseKeys(JSON.parse(value)); } catch { return null; }
	}, { toPlainOnly: true })
	@Column({ type: 'text', nullable: true })
	resolved: string | null;

	@ApiPropertyOptional({
		name: 'last_result',
		description: 'JSON object with execution result summary and failures',
		type: 'string',
	})
	@Expose({ name: 'last_result' })
	@IsOptional()
	@IsString()
	@MaxLength(4000)
	@Transform(({ obj }: { obj: { last_result?: string; lastResult?: string } }) => obj.last_result ?? obj.lastResult, {
		toClassOnly: true,
	})
	@Transform(({ value }: { value: string | null }) => {
		if (!value) return null;
		try { return toSnakeCaseKeys(JSON.parse(value)); } catch { return null; }
	}, { toPlainOnly: true })
	@Column({ type: 'text', nullable: true })
	lastResult: string | null;
}
