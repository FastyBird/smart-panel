import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { CreateChannelPropertyDto } from '../../../modules/devices/dto/create-channel-property.dto';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';

@ApiSchema({ name: 'DevicesShellyV1PluginCreateChannelProperty' })
export class CreateShellyV1ChannelPropertyDto extends CreateChannelPropertyDto {
	@ApiProperty({
		description: 'Channel property type identifier',
		example: 'devices-shelly-v1',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel property type string."}]' })
	readonly type: typeof DEVICES_SHELLY_V1_TYPE;
}
