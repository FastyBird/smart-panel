import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { CreateChannelDto } from '../../../modules/devices/dto/create-channel.dto';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';

@ApiSchema({ name: 'DevicesShellyV1PluginCreateChannel' })
export class CreateShellyV1ChannelDto extends CreateChannelDto {
	@ApiProperty({
		description: 'Channel type identifier',
		example: 'devices-shelly-v1',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel type string."}]' })
	readonly type: typeof DEVICES_SHELLY_V1_TYPE;
}

/**
 * Alias for DevicesShellyV1PluginCreateShellyV1Channel (OpenAPI spec compatibility)
 */
@ApiSchema({ name: 'DevicesShellyV1PluginCreateShellyV1Channel' })
export class DevicesShellyV1PluginCreateShellyV1Channel extends CreateShellyV1ChannelDto {}
