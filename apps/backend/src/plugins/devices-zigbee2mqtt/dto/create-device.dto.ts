import { Expose } from 'class-transformer';
import { IsOptional, IsString, ValidateIf } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

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

	@ApiPropertyOptional({
		description: 'Zigbee IEEE address',
		example: '0x00158d00018255df',
		nullable: true,
		name: 'ieee_address',
	})
	@Expose({ name: 'ieee_address' })
	@IsOptional()
	@IsString({
		message: '[{"field":"ieee_address","reason":"IEEE address must be a valid string."}]',
	})
	@ValidateIf((_, value) => value !== null)
	ieeeAddress?: string | null;

	@ApiPropertyOptional({
		description: 'Zigbee2MQTT friendly name',
		example: 'living_room_light',
		nullable: true,
		name: 'friendly_name',
	})
	@Expose({ name: 'friendly_name' })
	@IsOptional()
	@IsString({
		message: '[{"field":"friendly_name","reason":"Friendly name must be a valid string."}]',
	})
	@ValidateIf((_, value) => value !== null)
	friendlyName?: string | null;

	@ApiPropertyOptional({
		description: 'Device model identifier',
		example: 'WXKG01LM',
		nullable: true,
		name: 'model_id',
	})
	@Expose({ name: 'model_id' })
	@IsOptional()
	@IsString({
		message: '[{"field":"model_id","reason":"Model ID must be a valid string."}]',
	})
	@ValidateIf((_, value) => value !== null)
	modelId?: string | null;
}
