import { Expose } from 'class-transformer';
import { ChildEntity } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

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

	toString(): string {
		return `Zigbee2MQTT Channel Property [${this.identifier}] -> Property [${this.id}]`;
	}
}
