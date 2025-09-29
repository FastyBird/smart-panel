import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { CreateChannelPropertyDto } from '../../../modules/devices/dto/create-channel-property.dto';
import type { components } from '../../../openapi';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';

type CreateShellyNgChannelProperty = components['schemas']['DevicesShellyNgPluginCreateShellyNgChannelProperty'];

export class CreateShellyNgChannelPropertyDto
	extends CreateChannelPropertyDto
	implements CreateShellyNgChannelProperty
{
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel property type string."}]' })
	readonly type: typeof DEVICES_SHELLY_NG_TYPE;
}
