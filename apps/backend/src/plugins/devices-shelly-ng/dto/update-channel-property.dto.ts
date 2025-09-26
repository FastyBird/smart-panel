import { Expose } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { PropertyCategory } from '../../../modules/devices/devices.constants';
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

	@Expose()
	@IsOptional()
	@IsNotEmpty({
		message: '[{"field":"category","reason":"Category must be a valid property category."}]',
	})
	@IsEnum(PropertyCategory, {
		message: '[{"field":"category","reason":"Category must be a valid property category."}]',
	})
	category?: PropertyCategory;
}
