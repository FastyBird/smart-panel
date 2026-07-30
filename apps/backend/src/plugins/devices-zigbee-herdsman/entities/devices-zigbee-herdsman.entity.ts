import { Expose } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { ChildEntity, Column } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_ZIGBEE_HERDSMAN_TYPE } from '../devices-zigbee-herdsman.constants';

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginDataDevice' })
@ChildEntity()
export class ZigbeeHerdsmanDeviceEntity extends DeviceEntity {
	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_ZIGBEE_HERDSMAN_TYPE,
		example: DEVICES_ZIGBEE_HERDSMAN_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_ZIGBEE_HERDSMAN_TYPE;
	}

	@ApiProperty({
		description: 'Zigbee IEEE address',
		type: 'string',
		name: 'ieee_address',
		example: '0x00124b002216a490',
	})
	@Expose({ name: 'ieee_address' })
	@IsString()
	@Column({ name: 'ieee_address', nullable: true })
	ieeeAddress: string;

	@ApiPropertyOptional({
		description: 'Zigbee network address',
		type: 'number',
		name: 'network_address',
		nullable: true,
	})
	@Expose({ name: 'network_address' })
	@IsOptional()
	@IsNumber()
	@Column({ name: 'network_address', type: 'int', nullable: true })
	networkAddress: number | null = null;

	@ApiPropertyOptional({
		description: 'Device manufacturer name',
		type: 'string',
		name: 'manufacturer_name',
		nullable: true,
	})
	@Expose({ name: 'manufacturer_name' })
	@IsOptional()
	@IsString()
	@Column({ name: 'manufacturer_name', nullable: true })
	manufacturerName: string | null = null;

	@ApiPropertyOptional({
		description: 'Device model ID',
		type: 'string',
		name: 'model_id',
		nullable: true,
	})
	@Expose({ name: 'model_id' })
	@IsOptional()
	@IsString()
	@Column({ name: 'model_id', nullable: true })
	modelId: string | null = null;

	@ApiPropertyOptional({
		description: 'Device date code',
		type: 'string',
		name: 'date_code',
		nullable: true,
	})
	@Expose({ name: 'date_code' })
	@IsOptional()
	@IsString()
	@Column({ name: 'date_code', nullable: true })
	dateCode: string | null = null;

	@ApiPropertyOptional({
		description: 'Software build ID',
		type: 'string',
		name: 'software_build_id',
		nullable: true,
	})
	@Expose({ name: 'software_build_id' })
	@IsOptional()
	@IsString()
	@Column({ name: 'software_build_id', nullable: true })
	softwareBuildId: string | null = null;

	@ApiProperty({
		description: 'Whether the device interview has been completed',
		type: 'boolean',
		name: 'interview_completed',
		default: false,
	})
	@Expose({ name: 'interview_completed' })
	@IsBoolean()
	@Column({ name: 'interview_completed', type: 'boolean', default: false })
	interviewCompleted: boolean = false;

	toString(): string {
		return `Zigbee Herdsman Device [${this.ieeeAddress}] -> Device [${this.id}]`;
	}
}

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginDataChannel' })
@ChildEntity()
export class ZigbeeHerdsmanChannelEntity extends ChannelEntity {
	@ApiProperty({
		description: 'Channel type',
		type: 'string',
		default: DEVICES_ZIGBEE_HERDSMAN_TYPE,
		example: DEVICES_ZIGBEE_HERDSMAN_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_ZIGBEE_HERDSMAN_TYPE;
	}

	toString(): string {
		return `Zigbee Herdsman Channel [${this.identifier}] -> Channel [${this.id}]`;
	}
}

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginDataChannelProperty' })
@ChildEntity()
export class ZigbeeHerdsmanChannelPropertyEntity extends ChannelPropertyEntity {
	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_ZIGBEE_HERDSMAN_TYPE,
		example: DEVICES_ZIGBEE_HERDSMAN_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_ZIGBEE_HERDSMAN_TYPE;
	}

	@ApiPropertyOptional({
		description: 'Zigbee ZCL cluster name',
		type: 'string',
		name: 'zigbee_cluster',
		nullable: true,
	})
	@Expose({ name: 'zigbee_cluster' })
	@IsOptional()
	@IsString()
	@Column({ name: 'zigbee_cluster', nullable: true })
	zigbeeCluster: string | null = null;

	@ApiPropertyOptional({
		description: 'Zigbee ZCL attribute name',
		type: 'string',
		name: 'zigbee_attribute',
		nullable: true,
	})
	@Expose({ name: 'zigbee_attribute' })
	@IsOptional()
	@IsString()
	@Column({ name: 'zigbee_attribute', nullable: true })
	zigbeeAttribute: string | null = null;

	toString(): string {
		return `Zigbee Herdsman Channel Property [${this.identifier}] -> Property [${this.id}]`;
	}
}
