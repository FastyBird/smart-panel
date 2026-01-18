import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PropertyCategory } from '../../../modules/devices/devices.constants';
import { UpdateChannelPropertyDto } from '../../../modules/devices/dto/update-channel-property.dto';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';

@ApiSchema({ name: 'DevicesShellyV1PluginUpdateChannelProperty' })
export class UpdateShellyV1ChannelPropertyDto extends UpdateChannelPropertyDto {
	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_SHELLY_V1_TYPE,
		example: DEVICES_SHELLY_V1_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel property type string."}]' })
	readonly type: typeof DEVICES_SHELLY_V1_TYPE;

	@ApiPropertyOptional({
		description: 'Property category classification',
		enum: PropertyCategory,
		example: PropertyCategory.ON,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsNotEmpty({
		message: '[{"field":"category","reason":"Category must be a valid property category."}]',
	})
	@IsEnum(PropertyCategory, {
		message: '[{"field":"category","reason":"Category must be a valid property category."}]',
	})
	category?: PropertyCategory;
}
