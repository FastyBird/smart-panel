import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { CreateChannelDto } from '../../../modules/devices/dto/create-channel.dto';
import { DEVICES_ZIGBEE_HERDSMAN_TYPE } from '../devices-zigbee-herdsman.constants';

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginCreateChannel' })
export class CreateZigbeeHerdsmanChannelDto extends CreateChannelDto {
	@ApiProperty({
		description: 'Channel type',
		type: 'string',
		default: DEVICES_ZIGBEE_HERDSMAN_TYPE,
		example: DEVICES_ZIGBEE_HERDSMAN_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel type string."}]' })
	readonly type: typeof DEVICES_ZIGBEE_HERDSMAN_TYPE;
}
