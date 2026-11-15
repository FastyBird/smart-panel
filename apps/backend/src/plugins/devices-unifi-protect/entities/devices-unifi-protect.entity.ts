import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { ChildEntity, Column, Index } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_UNIFI_PROTECT_TYPE } from '../devices-unifi-protect.constants';

/**
 * Each Protect property is named the camelCase of its wire name (`protectNvrId` <- `protect_nvr_id`): the core
 * `PATCH /devices/:id` keeps only entity fields whose snake_case name the request carried. The columns use the same
 * names on the shared STI table. Identity is written by the plugin only and is immutable through the API.
 */
@ApiSchema({ name: 'DevicesUnifiProtectPluginDataDevice' })
@Index('UQ_unifi_protect_device_identity', ['protectNvrId', 'protectDeviceId'], {
	unique: true,
	where: `"type" = '${DEVICES_UNIFI_PROTECT_TYPE}' AND "protectNvrId" IS NOT NULL AND "protectDeviceId" IS NOT NULL`,
})
@ChildEntity(DEVICES_UNIFI_PROTECT_TYPE)
export class ProtectDeviceEntity extends DeviceEntity {
	@ApiPropertyOptional({
		name: 'protect_nvr_id',
		description: 'Identifier of the Protect NVR (console) the device belongs to',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'protect_nvr_id' })
	@IsOptional()
	@IsString()
	@Column({ type: 'varchar', nullable: true })
	protectNvrId: string | null;

	@ApiPropertyOptional({
		name: 'protect_device_id',
		description: 'Identifier of the device on the Protect NVR',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'protect_device_id' })
	@IsOptional()
	@IsString()
	@Column({ type: 'varchar', nullable: true })
	protectDeviceId: string | null;

	@ApiPropertyOptional({
		name: 'protect_model_key',
		description: 'Protect model key of the device (camera, sensor, light, ...)',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'protect_model_key' })
	@IsOptional()
	@IsString()
	@Column({ type: 'varchar', nullable: true })
	protectModelKey: string | null;

	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_UNIFI_PROTECT_TYPE,
		example: DEVICES_UNIFI_PROTECT_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_UNIFI_PROTECT_TYPE;
	}

	toString(): string {
		return `UniFi Protect Device [${this.identifier}] -> Device [${this.id}]`;
	}
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginDataChannel' })
@ChildEntity(DEVICES_UNIFI_PROTECT_TYPE)
export class ProtectChannelEntity extends ChannelEntity {
	@ApiProperty({
		description: 'Channel type',
		type: 'string',
		default: DEVICES_UNIFI_PROTECT_TYPE,
		example: DEVICES_UNIFI_PROTECT_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_UNIFI_PROTECT_TYPE;
	}

	toString(): string {
		return `UniFi Protect Channel [${this.identifier}] -> Channel [${this.id}]`;
	}
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginDataChannelProperty' })
@ChildEntity(DEVICES_UNIFI_PROTECT_TYPE)
export class ProtectChannelPropertyEntity extends ChannelPropertyEntity {
	@ApiPropertyOptional({
		name: 'protect_mapping_name',
		description: 'Stable mapping descriptor of the Protect field the property is derived from',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'protect_mapping_name' })
	@IsOptional()
	@IsString()
	@Column({ type: 'varchar', nullable: true })
	protectMappingName: string | null;

	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_UNIFI_PROTECT_TYPE,
		example: DEVICES_UNIFI_PROTECT_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_UNIFI_PROTECT_TYPE;
	}

	toString(): string {
		return `UniFi Protect Property [${this.identifier}] -> Property [${this.id}]`;
	}
}
