import { Expose } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { ChannelCategory } from '../../../modules/devices/devices.constants';
import { UpdateChannelDto } from '../../../modules/devices/dto/update-channel.dto';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';

export class UpdateShellyV1ChannelDto extends UpdateChannelDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel type string."}]' })
	readonly type: typeof DEVICES_SHELLY_V1_TYPE;

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
