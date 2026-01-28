import { Expose, Transform } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';
import { MediaActivationState } from '../spaces.constants';

import { SpaceMediaRoutingEntity } from './space-media-routing.entity';
import { SpaceEntity } from './space.entity';

/**
 * Represents the currently active media routing for a space.
 * Only ONE active routing per space is allowed at any time.
 * This entity tracks the activation state and any errors during activation.
 */
@ApiSchema({ name: 'SpacesModuleDataSpaceActiveMediaRouting' })
@Entity('spaces_module_active_media_routings')
@Unique(['spaceId'])
export class SpaceActiveMediaRoutingEntity extends BaseEntity {
	@ApiProperty({
		name: 'space_id',
		description: 'ID of the space this active routing belongs to',
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
		name: 'routing_id',
		description: 'ID of the active routing (nullable for Off state)',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'routing_id' })
	@IsOptional()
	@IsUUID('4')
	@Transform(({ obj }: { obj: { routing_id?: string; routingId?: string } }) => obj.routing_id ?? obj.routingId, {
		toClassOnly: true,
	})
	@Column({ nullable: true })
	routingId: string | null;

	@ManyToOne(() => SpaceMediaRoutingEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'routingId' })
	routing: SpaceMediaRoutingEntity | null;

	@ApiProperty({
		name: 'activation_state',
		description: 'Current state of the routing activation',
		enum: MediaActivationState,
		example: MediaActivationState.ACTIVE,
	})
	@Expose({ name: 'activation_state' })
	@IsEnum(MediaActivationState)
	@Transform(
		({ obj }: { obj: { activation_state?: string; activationState?: string } }) =>
			obj.activation_state ?? obj.activationState,
		{ toClassOnly: true },
	)
	@Column({
		type: 'varchar',
		default: MediaActivationState.DEACTIVATED,
	})
	activationState: MediaActivationState;

	@ApiProperty({
		name: 'activated_at',
		description: 'Timestamp when the routing was activated',
		type: 'string',
		format: 'date-time',
	})
	@Expose({ name: 'activated_at' })
	@IsDate()
	@Transform(({ obj }: { obj: { activated_at?: Date; activatedAt?: Date } }) => obj.activated_at ?? obj.activatedAt, {
		toClassOnly: true,
	})
	@Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
	activatedAt: Date;

	@ApiPropertyOptional({
		name: 'last_error',
		description: 'Last error message if activation failed',
		type: 'string',
		maxLength: 500,
	})
	@Expose({ name: 'last_error' })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	@Transform(({ obj }: { obj: { last_error?: string; lastError?: string } }) => obj.last_error ?? obj.lastError, {
		toClassOnly: true,
	})
	@Column({ type: 'varchar', length: 500, nullable: true })
	lastError: string | null;

	@ApiPropertyOptional({
		name: 'steps_executed',
		description: 'Number of execution steps completed',
		type: 'integer',
	})
	@Expose({ name: 'steps_executed' })
	@IsOptional()
	@Transform(
		({ obj }: { obj: { steps_executed?: number; stepsExecuted?: number } }) => obj.steps_executed ?? obj.stepsExecuted,
		{ toClassOnly: true },
	)
	@Column({ type: 'int', nullable: true })
	stepsExecuted: number | null;

	@ApiPropertyOptional({
		name: 'steps_failed',
		description: 'Number of execution steps that failed',
		type: 'integer',
	})
	@Expose({ name: 'steps_failed' })
	@IsOptional()
	@Transform(
		({ obj }: { obj: { steps_failed?: number; stepsFailed?: number } }) => obj.steps_failed ?? obj.stepsFailed,
		{ toClassOnly: true },
	)
	@Column({ type: 'int', nullable: true })
	stepsFailed: number | null;

	@ApiPropertyOptional({
		name: 'steps_skipped',
		description: 'Number of execution steps skipped (offline devices)',
		type: 'integer',
	})
	@Expose({ name: 'steps_skipped' })
	@IsOptional()
	@Transform(
		({ obj }: { obj: { steps_skipped?: number; stepsSkipped?: number } }) => obj.steps_skipped ?? obj.stepsSkipped,
		{ toClassOnly: true },
	)
	@Column({ type: 'int', nullable: true })
	stepsSkipped: number | null;
}
