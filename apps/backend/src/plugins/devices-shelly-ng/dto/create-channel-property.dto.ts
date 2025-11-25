import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiSchema } from '../../../common/decorators/api-schema.decorator';
import { CreateChannelPropertyDto } from '../../../modules/devices/dto/create-channel-property.dto';
import type { components } from '../../../openapi';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';

type CreateShellyNgChannelProperty = components['schemas']['DevicesShellyNgPluginCreateShellyNgChannelProperty'];

@ApiSchema('DevicesShellyNgPluginCreateShellyNgChannelProperty')
export class CreateShellyNgChannelPropertyDto
	extends CreateChannelPropertyDto
	implements CreateShellyNgChannelProperty
{
	@ApiProperty({
		description: 'Channel property type',
		example: DEVICES_SHELLY_NG_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel property type string."}]' })
	readonly type: typeof DEVICES_SHELLY_NG_TYPE;
}
