import { Expose } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { ChannelCategory } from '../../../modules/devices/devices.constants';
import { UpdateChannelDto } from '../../../modules/devices/dto/update-channel.dto';
import type { components } from '../../../openapi';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';

type UpdateShellyNgChannel = components['schemas']['DevicesShellyNgPluginUpdateShellyNgChannel'];

export class UpdateShellyNgChannelDto extends UpdateChannelDto implements UpdateShellyNgChannel {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel type string."}]' })
	type: typeof DEVICES_SHELLY_NG_TYPE;

	@Expose()
	@IsOptional()
	@IsNotEmpty({
		message: '[{"field":"category","reason":"Category must be a valid channel category."}]',
	})
	@IsEnum(ChannelCategory, {
		message: '[{"field":"category","reason":"Category must be a valid channel category."}]',
	})
	category?: ChannelCategory;
}
