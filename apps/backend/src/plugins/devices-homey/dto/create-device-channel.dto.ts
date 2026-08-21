import { Expose, Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { CreateDeviceChannelDto } from '../../../modules/devices/dto/create-device-channel.dto';
import { DEVICES_HOMEY_TYPE } from '../devices-homey.constants';

import { CreateHomeyDeviceChannelPropertyDto } from './create-device-channel-property.dto';

@ApiSchema({ name: 'DevicesHomeyPluginCreateDeviceChannel' })
export class CreateHomeyDeviceChannelDto extends CreateDeviceChannelDto {
	@ApiProperty({
		description: 'Channel type',
		type: 'string',
		default: DEVICES_HOMEY_TYPE,
		example: DEVICES_HOMEY_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel type string."}]' })
	readonly type: typeof DEVICES_HOMEY_TYPE;

	@ApiPropertyOptional({ description: 'Homey channel properties', type: [CreateHomeyDeviceChannelPropertyDto] })
	@Expose()
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateHomeyDeviceChannelPropertyDto)
	declare properties?: CreateHomeyDeviceChannelPropertyDto[];
}
