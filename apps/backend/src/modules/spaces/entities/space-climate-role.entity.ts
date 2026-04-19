import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { ChildEntity, Column, JoinColumn, ManyToOne } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ChannelEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { ClimateRole, SpaceRoleType } from '../spaces.constants';

import { SpaceRoleEntity } from './space-role.entity';

@ApiSchema({ name: 'SpacesModuleDataSpaceClimateRole' })
@ChildEntity(SpaceRoleType.CLIMATE)
export class SpaceClimateRoleEntity extends SpaceRoleEntity {
	@ApiProperty({
		description: 'Role type',
		enum: SpaceRoleType,
		default: SpaceRoleType.CLIMATE,
		example: SpaceRoleType.CLIMATE,
	})
	@Expose()
	get type(): SpaceRoleType {
		return SpaceRoleType.CLIMATE;
	}

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
	@Column({ nullable: true })
	deviceId: string;

	@ManyToOne(() => DeviceEntity, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'deviceId' })
	device: DeviceEntity;

	@ApiPropertyOptional({
		name: 'channel_id',
		description: 'ID of the channel (required for sensor roles, null for actuator roles)',
		type: 'string',
		format: 'uuid',
		example: 'c3d29ea4-632f-5e8c-c4af-dce8b9e6c0f8',
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
		description: 'The climate role for this device/channel in the space',
		enum: ClimateRole,
		example: ClimateRole.AUTO,
	})
	@Expose()
	@IsEnum(ClimateRole)
	@Column({
		type: 'varchar',
		nullable: true,
		default: ClimateRole.AUTO,
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
	@Column({ type: 'int', nullable: true, default: 0 })
	priority: number;
}
