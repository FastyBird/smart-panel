import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { UpdateChannelPropertyDto } from '../../../modules/devices/dto/update-channel-property.dto';
import type { components } from '../../../openapi';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';

type UpdateShellyNgChannelProperty = components['schemas']['DevicesShellyNgPluginUpdateShellyNgChannelProperty'];

export class UpdateShellyNgChannelPropertyDto
	extends UpdateChannelPropertyDto
	implements UpdateShellyNgChannelProperty
{
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel property type string."}]' })
	type: typeof DEVICES_SHELLY_NG_TYPE;
}
