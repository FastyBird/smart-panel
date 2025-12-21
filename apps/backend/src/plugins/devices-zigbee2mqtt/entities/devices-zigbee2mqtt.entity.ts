import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { ChildEntity, Column } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_ZIGBEE2MQTT_TYPE } from '../devices-zigbee2mqtt.constants';

@ApiSchema({ name: 'DevicesZigbee2mqttPluginDataDevice' })
@ChildEntity()
export class Zigbee2mqttDeviceEntity extends DeviceEntity {
	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_ZIGBEE2MQTT_TYPE,
		example: DEVICES_ZIGBEE2MQTT_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_ZIGBEE2MQTT_TYPE;
	}

	@ApiPropertyOptional({
		description: 'Zigbee IEEE address',
		type: 'string',
		example: '0x00158d00018255df',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ name: 'ieee_address', nullable: true, default: null })
	ieeeAddress: string | null = null;

	@ApiPropertyOptional({
		description: 'Zigbee2MQTT friendly name',
		type: 'string',
		example: 'living_room_light',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ name: 'friendly_name', nullable: true, default: null })
	friendlyName: string | null = null;

	@ApiPropertyOptional({
		description: 'Device model identifier',
		type: 'string',
		example: 'WXKG01LM',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ name: 'model_id', nullable: true, default: null })
	modelId: string | null = null;

	toString(): string {
		return `Zigbee2MQTT Device [${this.identifier}] -> Device [${this.id}]`;
	}
}

@ApiSchema({ name: 'DevicesZigbee2mqttPluginDataChannel' })
@ChildEntity()
export class Zigbee2mqttChannelEntity extends ChannelEntity {
	@ApiProperty({
		description: 'Channel type',
		type: 'string',
		default: DEVICES_ZIGBEE2MQTT_TYPE,
		example: DEVICES_ZIGBEE2MQTT_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_ZIGBEE2MQTT_TYPE;
	}

	@ApiPropertyOptional({
		description: 'Zigbee2MQTT endpoint identifier',
		type: 'string',
		example: 'l1',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ name: 'endpoint', nullable: true, default: null })
	endpoint: string | null = null;

	toString(): string {
		return `Zigbee2MQTT Channel [${this.identifier}] -> Channel [${this.id}]`;
	}
}

@ApiSchema({ name: 'DevicesZigbee2mqttPluginDataChannelProperty' })
@ChildEntity()
export class Zigbee2mqttChannelPropertyEntity extends ChannelPropertyEntity {
	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_ZIGBEE2MQTT_TYPE,
		example: DEVICES_ZIGBEE2MQTT_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_ZIGBEE2MQTT_TYPE;
	}

	@ApiPropertyOptional({
		description: 'Zigbee2MQTT property name in MQTT payload',
		type: 'string',
		example: 'brightness',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ name: 'z2m_property', nullable: true, default: null })
	z2mProperty: string | null = null;

	toString(): string {
		return `Zigbee2MQTT Channel Property [${this.identifier}] -> Property [${this.id}]`;
	}
}
