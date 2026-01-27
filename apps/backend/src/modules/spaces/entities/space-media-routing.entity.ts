import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';
import { MediaPowerPolicy, MediaRoutingType } from '../spaces.constants';

import { SpaceMediaEndpointEntity } from './space-media-endpoint.entity';
import { SpaceEntity } from './space.entity';

/**
 * Represents a media routing configuration (activity preset) within a space.
 * A routing defines which endpoints work together for a specific activity.
 */
@ApiSchema({ name: 'SpacesModuleDataSpaceMediaRouting' })
@Entity('spaces_module_media_routings')
@Unique(['spaceId', 'type'])
export class SpaceMediaRoutingEntity extends BaseEntity {
	@ApiProperty({
		name: 'space_id',
		description: 'ID of the space this routing belongs to',
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

	@ApiProperty({
		description: 'The type of this routing (activity preset)',
		enum: MediaRoutingType,
		example: MediaRoutingType.WATCH,
	})
	@Expose()
	@IsEnum(MediaRoutingType)
	@Column({
		type: 'varchar',
	})
	type: MediaRoutingType;

	@ApiProperty({
		description: 'Display name for this routing',
		type: 'string',
		maxLength: 100,
		example: 'Watch TV',
	})
	@Expose()
	@IsString()
	@MaxLength(100)
	@Column({ type: 'varchar', length: 100 })
	name: string;

	@ApiPropertyOptional({
		description: 'Icon identifier for this routing',
		type: 'string',
		maxLength: 50,
		example: 'mdi:television-play',
	})
	@Expose()
	@IsOptional()
	@IsString()
	@MaxLength(50)
	@Column({ type: 'varchar', length: 50, nullable: true })
	icon: string | null;

	@ApiPropertyOptional({
		name: 'display_endpoint_id',
		description: 'ID of the display endpoint for this routing',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'display_endpoint_id' })
	@IsOptional()
	@IsUUID('4')
	@Transform(
		({ obj }: { obj: { display_endpoint_id?: string; displayEndpointId?: string } }) =>
			obj.display_endpoint_id ?? obj.displayEndpointId,
		{ toClassOnly: true },
	)
	@Column({ nullable: true })
	displayEndpointId: string | null;

	@ManyToOne(() => SpaceMediaEndpointEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'displayEndpointId' })
	displayEndpoint: SpaceMediaEndpointEntity | null;

	@ApiPropertyOptional({
		name: 'audio_endpoint_id',
		description: 'ID of the audio output endpoint for this routing',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'audio_endpoint_id' })
	@IsOptional()
	@IsUUID('4')
	@Transform(
		({ obj }: { obj: { audio_endpoint_id?: string; audioEndpointId?: string } }) =>
			obj.audio_endpoint_id ?? obj.audioEndpointId,
		{ toClassOnly: true },
	)
	@Column({ nullable: true })
	audioEndpointId: string | null;

	@ManyToOne(() => SpaceMediaEndpointEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'audioEndpointId' })
	audioEndpoint: SpaceMediaEndpointEntity | null;

	@ApiPropertyOptional({
		name: 'source_endpoint_id',
		description: 'ID of the source endpoint for this routing',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'source_endpoint_id' })
	@IsOptional()
	@IsUUID('4')
	@Transform(
		({ obj }: { obj: { source_endpoint_id?: string; sourceEndpointId?: string } }) =>
			obj.source_endpoint_id ?? obj.sourceEndpointId,
		{ toClassOnly: true },
	)
	@Column({ nullable: true })
	sourceEndpointId: string | null;

	@ManyToOne(() => SpaceMediaEndpointEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'sourceEndpointId' })
	sourceEndpoint: SpaceMediaEndpointEntity | null;

	@ApiPropertyOptional({
		name: 'remote_target_endpoint_id',
		description: 'ID of the remote target endpoint for this routing',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'remote_target_endpoint_id' })
	@IsOptional()
	@IsUUID('4')
	@Transform(
		({ obj }: { obj: { remote_target_endpoint_id?: string; remoteTargetEndpointId?: string } }) =>
			obj.remote_target_endpoint_id ?? obj.remoteTargetEndpointId,
		{ toClassOnly: true },
	)
	@Column({ nullable: true })
	remoteTargetEndpointId: string | null;

	@ManyToOne(() => SpaceMediaEndpointEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'remoteTargetEndpointId' })
	remoteTargetEndpoint: SpaceMediaEndpointEntity | null;

	@ApiPropertyOptional({
		name: 'display_input',
		description: 'Input to switch to on the display when activating this routing',
		type: 'string',
		maxLength: 50,
		example: 'HDMI1',
	})
	@Expose({ name: 'display_input' })
	@IsOptional()
	@IsString()
	@MaxLength(50)
	@Transform(({ obj }: { obj: { display_input?: string; displayInput?: string } }) => obj.display_input ?? obj.displayInput, {
		toClassOnly: true,
	})
	@Column({ type: 'varchar', length: 50, nullable: true })
	displayInput: string | null;

	@ApiPropertyOptional({
		name: 'audio_input',
		description: 'Input to switch to on the audio device when activating this routing',
		type: 'string',
		maxLength: 50,
		example: 'optical',
	})
	@Expose({ name: 'audio_input' })
	@IsOptional()
	@IsString()
	@MaxLength(50)
	@Transform(({ obj }: { obj: { audio_input?: string; audioInput?: string } }) => obj.audio_input ?? obj.audioInput, {
		toClassOnly: true,
	})
	@Column({ type: 'varchar', length: 50, nullable: true })
	audioInput: string | null;

	@ApiPropertyOptional({
		name: 'audio_volume_preset',
		description: 'Default volume level (0-100) when activating this routing',
		type: 'integer',
		minimum: 0,
		maximum: 100,
		example: 50,
	})
	@Expose({ name: 'audio_volume_preset' })
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(100)
	@Transform(
		({ obj }: { obj: { audio_volume_preset?: number; audioVolumePreset?: number } }) =>
			obj.audio_volume_preset ?? obj.audioVolumePreset,
		{ toClassOnly: true },
	)
	@Column({ type: 'int', nullable: true })
	audioVolumePreset: number | null;

	@ApiProperty({
		name: 'power_policy',
		description: 'How power is handled when activating this routing',
		enum: MediaPowerPolicy,
		example: MediaPowerPolicy.ON,
	})
	@Expose({ name: 'power_policy' })
	@IsEnum(MediaPowerPolicy)
	@Transform(({ obj }: { obj: { power_policy?: string; powerPolicy?: string } }) => obj.power_policy ?? obj.powerPolicy, {
		toClassOnly: true,
	})
	@Column({
		type: 'varchar',
		default: MediaPowerPolicy.ON,
	})
	powerPolicy: MediaPowerPolicy;

	@ApiProperty({
		name: 'is_default',
		description: 'Whether this is an auto-created default routing',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'is_default' })
	@IsBoolean()
	@Transform(({ obj }: { obj: { is_default?: boolean; isDefault?: boolean } }) => obj.is_default ?? obj.isDefault, {
		toClassOnly: true,
	})
	@Column({ type: 'boolean', default: true })
	isDefault: boolean;
}
