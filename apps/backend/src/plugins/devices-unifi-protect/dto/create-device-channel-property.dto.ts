import { Expose } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { CreateDeviceChannelPropertyDto } from '../../../modules/devices/dto/create-device-channel-property.dto';
import { DEVICES_UNIFI_PROTECT_TYPE } from '../devices-unifi-protect.constants';

@ApiSchema({ name: 'DevicesUnifiProtectPluginCreateDeviceChannelProperty' })
export class CreateProtectDeviceChannelPropertyDto extends CreateDeviceChannelPropertyDto {
	@ApiPropertyOptional({
		name: 'protect_mapping_name',
		description: 'Stable mapping descriptor of the Protect field the property is derived from',
	})
	@Expose({ name: 'protect_mapping_name' })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	protectMappingName?: string;

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
