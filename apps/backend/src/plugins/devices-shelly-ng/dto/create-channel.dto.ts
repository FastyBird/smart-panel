import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiSchema } from '../../../common/decorators/api-schema.decorator';
import { CreateChannelDto } from '../../../modules/devices/dto/create-channel.dto';
import type { components } from '../../../openapi';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';

type CreateShellyNgChannel = components['schemas']['DevicesShellyNgPluginCreateShellyNgChannel'];

@ApiSchema('DevicesShellyNgPluginCreateShellyNgChannel')
export class CreateShellyNgChannelDto extends CreateChannelDto implements CreateShellyNgChannel {
	@ApiProperty({
		description: 'Channel type',
		example: DEVICES_SHELLY_NG_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel type string."}]' })
	readonly type: typeof DEVICES_SHELLY_NG_TYPE;
}
