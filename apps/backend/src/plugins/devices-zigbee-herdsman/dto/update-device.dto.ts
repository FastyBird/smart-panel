import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdateDeviceDto } from '../../../modules/devices/dto/update-device.dto';
import { DEVICES_ZIGBEE_HERDSMAN_TYPE } from '../devices-zigbee-herdsman.constants';

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginUpdateDevice' })
export class UpdateZigbeeHerdsmanDeviceDto extends UpdateDeviceDto {
	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_ZIGBEE_HERDSMAN_TYPE,
		example: DEVICES_ZIGBEE_HERDSMAN_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	readonly type: typeof DEVICES_ZIGBEE_HERDSMAN_TYPE;
}
