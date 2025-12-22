import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { CreateChannelPropertyDto } from '../../../modules/devices/dto/create-channel-property.dto';
import { DEVICES_ZIGBEE2MQTT_TYPE } from '../devices-zigbee2mqtt.constants';

@ApiSchema({ name: 'DevicesZigbee2mqttPluginCreateChannelProperty' })
export class CreateZigbee2mqttChannelPropertyDto extends CreateChannelPropertyDto {
	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_ZIGBEE2MQTT_TYPE,
		example: DEVICES_ZIGBEE2MQTT_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid property type string."}]' })
	readonly type: typeof DEVICES_ZIGBEE2MQTT_TYPE;
}
