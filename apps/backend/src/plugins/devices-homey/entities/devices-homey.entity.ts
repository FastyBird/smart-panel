import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { ChildEntity, Column, Index } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_HOMEY_TYPE } from '../devices-homey.constants';

@ApiSchema({ name: 'DevicesHomeyPluginDataDevice' })
@ChildEntity(DEVICES_HOMEY_TYPE)
export class HomeyDeviceEntity extends DeviceEntity {
	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_HOMEY_TYPE,
		example: DEVICES_HOMEY_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_HOMEY_TYPE;
	}

	toString(): string {
		return `Homey Device [${this.identifier}] -> Device [${this.id}]`;
	}
}

@ApiSchema({ name: 'DevicesHomeyPluginDataChannel' })
@ChildEntity(DEVICES_HOMEY_TYPE)
export class HomeyChannelEntity extends ChannelEntity {
	@ApiProperty({
		description: 'Channel type',
		type: 'string',
		default: DEVICES_HOMEY_TYPE,
		example: DEVICES_HOMEY_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_HOMEY_TYPE;
	}

	toString(): string {
		return `Homey Channel [${this.identifier}] -> Channel [${this.id}]`;
	}
}

@ApiSchema({ name: 'DevicesHomeyPluginDataChannelProperty' })
@Index('UQ_homey_capability_mapping_channel', ['homeyCapabilityId', 'homeyMappingName', 'channel'], {
	unique: true,
	where: `"type" = '${DEVICES_HOMEY_TYPE}' AND "homeyCapabilityId" IS NOT NULL AND "homeyMappingName" IS NOT NULL`,
})
@ChildEntity(DEVICES_HOMEY_TYPE)
export class HomeyChannelPropertyEntity extends ChannelPropertyEntity {
	@ApiPropertyOptional({
		name: 'homey_capability_id',
		description: 'Authoritative full Homey capability identifier for adopted mapping properties',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'homey_capability_id' })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	homeyCapabilityId: string | null;

	@ApiPropertyOptional({
		name: 'homey_mapping_name',
		description: 'Stable mapping descriptor that disambiguates capability fan-out',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'homey_mapping_name' })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	homeyMappingName: string | null;

	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_HOMEY_TYPE,
		example: DEVICES_HOMEY_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_HOMEY_TYPE;
	}

	toString(): string {
		return `Homey Capability [${this.identifier}] -> Property [${this.id}]`;
	}
}
