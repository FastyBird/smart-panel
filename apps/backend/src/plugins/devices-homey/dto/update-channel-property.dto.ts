import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PropertyCategory } from '../../../modules/devices/devices.constants';
import { UpdateChannelPropertyDto } from '../../../modules/devices/dto/update-channel-property.dto';
import { DEVICES_HOMEY_TYPE } from '../devices-homey.constants';

@ApiSchema({ name: 'DevicesHomeyPluginUpdateChannelProperty' })
export class UpdateHomeyChannelPropertyDto extends UpdateChannelPropertyDto {
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

	@ApiPropertyOptional({
		name: 'homey_capability_id',
		description: 'Authoritative full Homey capability identifier when reconciling provider metadata',
		type: 'string',
	})
	@Expose({ name: 'homey_capability_id' })
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	homeyCapabilityId?: string;

	@ApiPropertyOptional({
		name: 'homey_mapping_name',
		description: 'Stable mapping descriptor when reconciling provider metadata',
		type: 'string',
	})
	@Expose({ name: 'homey_mapping_name' })
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	homeyMappingName?: string;

	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_HOMEY_TYPE,
		example: DEVICES_HOMEY_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel property type string."}]' })
	readonly type: typeof DEVICES_HOMEY_TYPE;
}
