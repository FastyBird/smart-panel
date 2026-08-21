import { Expose } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { CreateDeviceChannelPropertyDto } from '../../../modules/devices/dto/create-device-channel-property.dto';
import { DEVICES_HOMEY_TYPE } from '../devices-homey.constants';

@ApiSchema({ name: 'DevicesHomeyPluginCreateDeviceChannelProperty' })
export class CreateHomeyDeviceChannelPropertyDto extends CreateDeviceChannelPropertyDto {
	@ApiPropertyOptional({
		name: 'homey_capability_id',
		description: 'Authoritative full Homey capability identifier for an adopted mapping property',
	})
	@Expose({ name: 'homey_capability_id' })
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	homeyCapabilityId?: string;

	@ApiPropertyOptional({
		name: 'homey_mapping_name',
		description: 'Stable mapping descriptor that disambiguates capability fan-out',
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
