import { Expose } from 'class-transformer';
import { IsOptional, IsString, ValidateIf } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateChannelPropertyDto } from '../../../modules/devices/dto/update-channel-property.dto';
import { DEVICES_ZIGBEE2MQTT_TYPE } from '../devices-zigbee2mqtt.constants';

@ApiSchema({ name: 'DevicesZigbee2mqttPluginUpdateChannelProperty' })
export class UpdateZigbee2mqttChannelPropertyDto extends UpdateChannelPropertyDto {
	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_ZIGBEE2MQTT_TYPE,
		example: DEVICES_ZIGBEE2MQTT_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid property type string."}]' })
	readonly type: typeof DEVICES_ZIGBEE2MQTT_TYPE;

	@ApiPropertyOptional({
		description: 'Zigbee2MQTT property name in MQTT payload',
		example: 'brightness',
		nullable: true,
		name: 'z2m_property',
	})
	@Expose({ name: 'z2m_property' })
	@IsOptional()
	@IsString({
		message: '[{"field":"z2m_property","reason":"Z2M property must be a valid string."}]',
	})
	@ValidateIf((_, value) => value !== null)
	z2mProperty?: string | null;
}
