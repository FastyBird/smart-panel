import { Expose, Transform } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ChildEntity, Column } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { toSnakeCaseKeys } from '../../../common/utils/transform.utils';
import { SpaceRoleEntity } from '../../../modules/spaces/entities/space-role.entity';
import { SpaceRoleType } from '../../../modules/spaces/spaces.constants';
import { MediaActivationState, MediaActivityKey } from '../spaces-home-control.constants';

const jsonToSnakeCaseTransformer = ({ value }: { value: string | null }): Record<string, unknown> | null => {
	if (!value) return null;
	try {
		return toSnakeCaseKeys<Record<string, unknown>, Record<string, unknown>>(
			JSON.parse(value) as Record<string, unknown>,
		);
	} catch {
		return null;
	}
};

/**
 * Represents the currently active media activity for a space.
 * Only ONE active activity per space is allowed at any time (enforced by a partial
 * unique index on `spaceId` where `type='active_media'`).
 * Tracks activation state, resolved devices, and execution results.
 */
@ApiSchema({ name: 'SpacesModuleDataSpaceActiveMediaActivity' })
@ChildEntity(SpaceRoleType.ACTIVE_MEDIA)
export class SpaceActiveMediaActivityEntity extends SpaceRoleEntity {
	@ApiProperty({
		description: 'Role type',
		enum: SpaceRoleType,
		default: SpaceRoleType.ACTIVE_MEDIA,
		example: SpaceRoleType.ACTIVE_MEDIA,
	})
	@Expose()
	get type(): SpaceRoleType {
		return SpaceRoleType.ACTIVE_MEDIA;
	}

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
		nullable: true,
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
	@Transform(jsonToSnakeCaseTransformer, { toPlainOnly: true })
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
	@Transform(jsonToSnakeCaseTransformer, { toPlainOnly: true })
	@Column({ type: 'text', nullable: true })
	lastResult: string | null;
}
