import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';
import { MediaActivityKey } from '../spaces.constants';

import { SpaceEntity } from './space.entity';

/**
 * Represents a per-space media activity binding.
 * Maps a predefined activity (watch, listen, gaming, etc.) to concrete derived endpoint IDs.
 */
@ApiSchema({ name: 'SpacesModuleDataSpaceMediaActivityBinding' })
@Entity('spaces_module_media_activity_bindings')
@Unique(['spaceId', 'activityKey'])
export class SpaceMediaActivityBindingEntity extends BaseEntity {
	@ApiProperty({
		name: 'space_id',
		description: 'ID of the space this binding belongs to',
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
		name: 'activity_key',
		description: 'The activity this binding configures',
		enum: MediaActivityKey,
		example: MediaActivityKey.WATCH,
	})
	@Expose({ name: 'activity_key' })
	@IsEnum(MediaActivityKey)
	@Transform(
		({ obj }: { obj: { activity_key?: string; activityKey?: string } }) => obj.activity_key ?? obj.activityKey,
		{ toClassOnly: true },
	)
	@Column({ type: 'varchar' })
	activityKey: MediaActivityKey;

	@ApiPropertyOptional({
		name: 'display_endpoint_id',
		description: 'Derived endpoint ID for the display slot',
		type: 'string',
		maxLength: 255,
		example: 'space123:display:device456',
	})
	@Expose({ name: 'display_endpoint_id' })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@Transform(
		({ obj }: { obj: { display_endpoint_id?: string; displayEndpointId?: string } }) =>
			obj.display_endpoint_id ?? obj.displayEndpointId,
		{ toClassOnly: true },
	)
	@Column({ type: 'varchar', length: 255, nullable: true })
	displayEndpointId: string | null;

	@ApiPropertyOptional({
		name: 'audio_endpoint_id',
		description: 'Derived endpoint ID for the audio output slot',
		type: 'string',
		maxLength: 255,
		example: 'space123:audio_output:device789',
	})
	@Expose({ name: 'audio_endpoint_id' })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@Transform(
		({ obj }: { obj: { audio_endpoint_id?: string; audioEndpointId?: string } }) =>
			obj.audio_endpoint_id ?? obj.audioEndpointId,
		{ toClassOnly: true },
	)
	@Column({ type: 'varchar', length: 255, nullable: true })
	audioEndpointId: string | null;

	@ApiPropertyOptional({
		name: 'source_endpoint_id',
		description: 'Derived endpoint ID for the source slot',
		type: 'string',
		maxLength: 255,
		example: 'space123:source:device012',
	})
	@Expose({ name: 'source_endpoint_id' })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@Transform(
		({ obj }: { obj: { source_endpoint_id?: string; sourceEndpointId?: string } }) =>
			obj.source_endpoint_id ?? obj.sourceEndpointId,
		{ toClassOnly: true },
	)
	@Column({ type: 'varchar', length: 255, nullable: true })
	sourceEndpointId: string | null;

	@ApiPropertyOptional({
		name: 'remote_endpoint_id',
		description: 'Derived endpoint ID for the remote target slot',
		type: 'string',
		maxLength: 255,
		example: 'space123:remote_target:device456',
	})
	@Expose({ name: 'remote_endpoint_id' })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@Transform(
		({ obj }: { obj: { remote_endpoint_id?: string; remoteEndpointId?: string } }) =>
			obj.remote_endpoint_id ?? obj.remoteEndpointId,
		{ toClassOnly: true },
	)
	@Column({ type: 'varchar', length: 255, nullable: true })
	remoteEndpointId: string | null;

	@ApiPropertyOptional({
		name: 'display_input_id',
		description: 'Input to select on the display (e.g. HDMI1, Apps). Only valid if display supports inputSelect.',
		type: 'string',
		maxLength: 50,
		example: 'HDMI1',
	})
	@Expose({ name: 'display_input_id' })
	@IsOptional()
	@IsString()
	@MaxLength(50)
	@Transform(
		({ obj }: { obj: { display_input_id?: string; displayInputId?: string } }) =>
			obj.display_input_id ?? obj.displayInputId,
		{ toClassOnly: true },
	)
	@Column({ type: 'varchar', length: 50, nullable: true })
	displayInputId: string | null;

	@ApiPropertyOptional({
		name: 'audio_input_id',
		description:
			'Input to select on the audio endpoint (e.g. HDMI1, Optical). Only valid if audio supports inputSelect.',
		type: 'string',
		maxLength: 50,
		example: 'HDMI1',
	})
	@Expose({ name: 'audio_input_id' })
	@IsOptional()
	@IsString()
	@MaxLength(50)
	@Transform(
		({ obj }: { obj: { audio_input_id?: string; audioInputId?: string } }) => obj.audio_input_id ?? obj.audioInputId,
		{ toClassOnly: true },
	)
	@Column({ type: 'varchar', length: 50, nullable: true })
	audioInputId: string | null;

	@ApiPropertyOptional({
		name: 'source_input_id',
		description:
			'Input to select on the source endpoint (e.g. HDMI1, Mode). Only valid if source supports inputSelect.',
		type: 'string',
		maxLength: 50,
		example: 'HDMI1',
	})
	@Expose({ name: 'source_input_id' })
	@IsOptional()
	@IsString()
	@MaxLength(50)
	@Transform(
		({ obj }: { obj: { source_input_id?: string; sourceInputId?: string } }) =>
			obj.source_input_id ?? obj.sourceInputId,
		{ toClassOnly: true },
	)
	@Column({ type: 'varchar', length: 50, nullable: true })
	sourceInputId: string | null;

	@ApiPropertyOptional({
		name: 'audio_volume_preset',
		description: 'Default volume level (0-100) when activating this activity',
		type: 'integer',
		minimum: 0,
		maximum: 100,
		example: 30,
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
}
