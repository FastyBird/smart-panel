import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ChannelCategory } from '../../../modules/devices/devices.constants';
import { UpdateChannelDto } from '../../../modules/devices/dto/update-channel.dto';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';

@ApiSchema({ name: 'DevicesShellyNgPluginUpdateChannel' })
export class UpdateShellyNgChannelDto extends UpdateChannelDto {
	@ApiProperty({
		description: 'Channel type',
		type: 'string',
		default: DEVICES_SHELLY_NG_TYPE,
		example: DEVICES_SHELLY_NG_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel type string."}]' })
	type: typeof DEVICES_SHELLY_NG_TYPE;

	@ApiPropertyOptional({
		description: 'Channel category',
		enum: ChannelCategory,
		example: ChannelCategory.GENERIC,
	})
	@Expose()
	@Transform(({ value }) => (value === null ? undefined : value))
	@IsOptional()
	@IsNotEmpty({
		message: '[{"field":"category","reason":"Category must be a valid channel category."}]',
	})
	@IsEnum(ChannelCategory, {
		message: '[{"field":"category","reason":"Category must be a valid channel category."}]',
	})
	category?: ChannelCategory;
}
