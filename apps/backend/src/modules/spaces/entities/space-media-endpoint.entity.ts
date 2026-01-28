import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';
import { ChannelEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { MediaEndpointType } from '../spaces.constants';

import { SpaceEntity } from './space.entity';

/**
 * Represents a functional media endpoint within a space.
 * An endpoint is a projection of a device's media capabilities.
 * A single device can have multiple endpoints (e.g., TV as display + audio_output).
 */
@ApiSchema({ name: 'SpacesModuleDataSpaceMediaEndpoint' })
@Entity('spaces_module_media_endpoints')
@Unique(['spaceId', 'deviceId', 'type'])
export class SpaceMediaEndpointEntity extends BaseEntity {
	@ApiProperty({
		name: 'space_id',
		description: 'ID of the space this endpoint belongs to',
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
		name: 'device_id',
		description: 'ID of the media device',
		type: 'string',
		format: 'uuid',
		example: 'a2b19ca3-521e-4d7b-b3fe-bcb7a8d5b9e7',
	})
	@Expose({ name: 'device_id' })
	@IsUUID('4')
	@Transform(({ obj }: { obj: { device_id?: string; deviceId?: string } }) => obj.device_id ?? obj.deviceId, {
		toClassOnly: true,
	})
	@Column({ nullable: false })
	deviceId: string;

	@ManyToOne(() => DeviceEntity, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'deviceId' })
	device: DeviceEntity;

	@ApiPropertyOptional({
		name: 'channel_id',
		description: 'ID of the specific channel for this endpoint (optional)',
		type: 'string',
		format: 'uuid',
		example: 'c3d29eb4-632f-5e8c-c4af-ded8b9e6c0f8',
	})
	@Expose({ name: 'channel_id' })
	@IsOptional()
	@IsUUID('4')
	@Transform(({ obj }: { obj: { channel_id?: string; channelId?: string } }) => obj.channel_id ?? obj.channelId, {
		toClassOnly: true,
	})
	@Column({ nullable: true })
	channelId: string | null;

	@ManyToOne(() => ChannelEntity, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'channelId' })
	channel: ChannelEntity | null;

	@ApiProperty({
		description: 'The functional type of this endpoint',
		enum: MediaEndpointType,
		example: MediaEndpointType.DISPLAY,
	})
	@Expose()
	@IsEnum(MediaEndpointType)
	@Column({
		type: 'varchar',
	})
	type: MediaEndpointType;

	@ApiPropertyOptional({
		description: 'Custom name for this endpoint (defaults to device name)',
		type: 'string',
		maxLength: 100,
		example: 'Living Room TV',
	})
	@Expose()
	@IsOptional()
	@IsString()
	@MaxLength(100)
	@Column({ type: 'varchar', length: 100, nullable: true })
	name: string | null;

	@ApiPropertyOptional({
		description: 'JSON object describing detected capabilities and their property mappings',
		type: 'string',
		example:
			'{"power":{"propertyId":"...","permission":"read_write"},"volume":{"propertyId":"...","permission":"read_write"}}',
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ type: 'text', nullable: true })
	capabilities: string | null;

	@ApiPropertyOptional({
		name: 'preferred_for',
		description: 'JSON array of routing types this endpoint is preferred for',
		type: 'string',
		example: '["watch","gaming"]',
	})
	@Expose({ name: 'preferred_for' })
	@IsOptional()
	@IsString()
	@Transform(
		({ obj }: { obj: { preferred_for?: string; preferredFor?: string } }) => obj.preferred_for ?? obj.preferredFor,
		{
			toClassOnly: true,
		},
	)
	@Column({ type: 'text', nullable: true })
	preferredFor: string | null;
}
