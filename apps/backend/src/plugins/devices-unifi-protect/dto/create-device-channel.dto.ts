import { Expose, Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { CreateDeviceChannelDto } from '../../../modules/devices/dto/create-device-channel.dto';
import { DEVICES_UNIFI_PROTECT_TYPE } from '../devices-unifi-protect.constants';

import { CreateProtectDeviceChannelPropertyDto } from './create-device-channel-property.dto';

@ApiSchema({ name: 'DevicesUnifiProtectPluginCreateDeviceChannel' })
export class CreateProtectDeviceChannelDto extends CreateDeviceChannelDto {
	@ApiProperty({
		description: 'Channel type',
		type: 'string',
		default: DEVICES_UNIFI_PROTECT_TYPE,
		example: DEVICES_UNIFI_PROTECT_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel type string."}]' })
	readonly type: typeof DEVICES_UNIFI_PROTECT_TYPE;

	@ApiPropertyOptional({ description: 'Protect channel properties', type: [CreateProtectDeviceChannelPropertyDto] })
	@Expose()
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateProtectDeviceChannelPropertyDto)
	declare properties?: CreateProtectDeviceChannelPropertyDto[];
}
