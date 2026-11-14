import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PropertyCategory } from '../../../modules/devices/devices.constants';
import { UpdateChannelPropertyDto } from '../../../modules/devices/dto/update-channel-property.dto';
import { DEVICES_UNIFI_PROTECT_TYPE } from '../devices-unifi-protect.constants';

@ApiSchema({ name: 'DevicesUnifiProtectPluginUpdateChannelProperty' })
export class UpdateProtectChannelPropertyDto extends UpdateChannelPropertyDto {
	@ApiPropertyOptional({
		description: 'Property category',
		enum: PropertyCategory,
		example: PropertyCategory.GENERIC,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"category","reason":"Category must be a valid property category."}]' })
	@IsEnum(PropertyCategory, {
		message: '[{"field":"category","reason":"Category must be a valid property category."}]',
	})
	category?: PropertyCategory;

	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_UNIFI_PROTECT_TYPE,
		example: DEVICES_UNIFI_PROTECT_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel property type string."}]' })
	readonly type: typeof DEVICES_UNIFI_PROTECT_TYPE;
}
