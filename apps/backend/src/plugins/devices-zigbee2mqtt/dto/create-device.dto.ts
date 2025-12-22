import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { CreateDeviceDto } from '../../../modules/devices/dto/create-device.dto';
import { DEVICES_ZIGBEE2MQTT_TYPE } from '../devices-zigbee2mqtt.constants';

@ApiSchema({ name: 'DevicesZigbee2mqttPluginCreateDevice' })
export class CreateZigbee2mqttDeviceDto extends CreateDeviceDto {
	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_ZIGBEE2MQTT_TYPE,
		example: DEVICES_ZIGBEE2MQTT_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	readonly type: typeof DEVICES_ZIGBEE2MQTT_TYPE;
}
