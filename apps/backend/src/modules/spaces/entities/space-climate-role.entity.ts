import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';
import { ChannelEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { ClimateRole } from '../spaces.constants';

import { SpaceEntity } from './space.entity';

@ApiSchema({ name: 'SpacesModuleDataSpaceClimateRole' })
@Entity('spaces_module_climate_roles')
@Unique(['spaceId', 'deviceId', 'channelId'])
export class SpaceClimateRoleEntity extends BaseEntity {
	@ApiProperty({
		name: 'space_id',
		description: 'ID of the space this role assignment belongs to',
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
		description: 'ID of the climate device',
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

	@ApiProperty({
		name: 'channel_id',
		description: 'ID of the climate channel within the device',
		type: 'string',
		format: 'uuid',
		example: 'c3d29eb4-632f-5e8c-c4af-ded8b9e6c0f8',
	})
	@Expose({ name: 'channel_id' })
	@IsUUID('4')
	@Transform(({ obj }: { obj: { channel_id?: string; channelId?: string } }) => obj.channel_id ?? obj.channelId, {
		toClassOnly: true,
	})
	@Column({ nullable: false })
	channelId: string;

	@ManyToOne(() => ChannelEntity, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'channelId' })
	channel: ChannelEntity;

	@ApiProperty({
		description: 'The climate role for this device/channel in the space',
		enum: ClimateRole,
		example: ClimateRole.PRIMARY,
	})
	@Expose()
	@IsEnum(ClimateRole)
	@Column({
		type: 'varchar',
		default: ClimateRole.OTHER,
	})
	role: ClimateRole;

	@ApiPropertyOptional({
		description: 'Priority for selecting defaults within the same role (lower = higher priority)',
		type: 'integer',
		example: 0,
	})
	@Expose()
	@IsOptional()
	@IsInt()
	@Min(0)
	@Column({ type: 'int', default: 0 })
	priority: number;
}
