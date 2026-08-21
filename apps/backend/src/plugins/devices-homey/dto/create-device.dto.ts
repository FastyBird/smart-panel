import { Expose, Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { CreateDeviceDto } from '../../../modules/devices/dto/create-device.dto';
import { DEVICES_HOMEY_TYPE } from '../devices-homey.constants';

import { CreateHomeyDeviceChannelDto } from './create-device-channel.dto';

@ApiSchema({ name: 'DevicesHomeyPluginCreateDevice' })
export class CreateHomeyDeviceDto extends CreateDeviceDto {
	@ApiPropertyOptional({ description: 'Homey device channels', type: [CreateHomeyDeviceChannelDto] })
	@Expose()
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateHomeyDeviceChannelDto)
	declare channels?: CreateHomeyDeviceChannelDto[];

	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_HOMEY_TYPE,
		example: DEVICES_HOMEY_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	readonly type: typeof DEVICES_HOMEY_TYPE;
}
