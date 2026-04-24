import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { ChildEntity, Column, JoinColumn, ManyToOne } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ChannelEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { SpaceRoleEntity } from '../../../modules/spaces/entities/space-role.entity';
import { SpaceRoleType } from '../../../modules/spaces/spaces.constants';
import { LightingRole } from '../spaces-home-control.constants';

@ApiSchema({ name: 'SpacesModuleDataSpaceLightingRole' })
@ChildEntity(SpaceRoleType.LIGHTING)
export class SpaceLightingRoleEntity extends SpaceRoleEntity {
	@ApiProperty({
		description: 'Role type',
		enum: SpaceRoleType,
		default: SpaceRoleType.LIGHTING,
		example: SpaceRoleType.LIGHTING,
	})
	@Expose()
	get type(): SpaceRoleType {
		return SpaceRoleType.LIGHTING;
	}

	@ApiProperty({
		name: 'device_id',
		description: 'ID of the lighting device',
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

	@ApiProperty({
		name: 'channel_id',
		description: 'ID of the light channel within the device',
		type: 'string',
		format: 'uuid',
		example: 'c3d29eb4-632f-5e8c-c4af-ded8b9e6c0f8',
	})
	@Expose({ name: 'channel_id' })
	@IsUUID('4')
	@Transform(({ obj }: { obj: { channel_id?: string; channelId?: string } }) => obj.channel_id ?? obj.channelId, {
		toClassOnly: true,
	})
	@Column({ nullable: true })
	channelId: string;

	@ManyToOne(() => ChannelEntity, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'channelId' })
	channel: ChannelEntity;

	@ApiProperty({
		description: 'The lighting role for this device/channel in the space',
		enum: LightingRole,
		example: LightingRole.MAIN,
	})
	@Expose()
	@IsEnum(LightingRole)
	@Column({
		type: 'varchar',
		nullable: true,
		default: LightingRole.OTHER,
	})
	role: LightingRole;

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
