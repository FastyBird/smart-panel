import { Expose, Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { CreateDeviceDto } from '../../../modules/devices/dto/create-device.dto';
import { DEVICES_UNIFI_PROTECT_TYPE } from '../devices-unifi-protect.constants';

import { CreateProtectDeviceChannelDto } from './create-device-channel.dto';

@ApiSchema({ name: 'DevicesUnifiProtectPluginCreateDevice' })
export class CreateProtectDeviceDto extends CreateDeviceDto {
	@ApiPropertyOptional({ description: 'Protect device channels', type: [CreateProtectDeviceChannelDto] })
	@Expose()
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateProtectDeviceChannelDto)
	declare channels?: CreateProtectDeviceChannelDto[];

	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_UNIFI_PROTECT_TYPE,
		example: DEVICES_UNIFI_PROTECT_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	readonly type: typeof DEVICES_UNIFI_PROTECT_TYPE;

	@ApiPropertyOptional({
		name: 'protect_nvr_id',
		description: 'Identifier of the Protect NVR (console) the device belongs to',
	})
	@Expose({ name: 'protect_nvr_id' })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	protectNvrId?: string;

	@ApiPropertyOptional({
		name: 'protect_device_id',
		description: 'Identifier of the device on the Protect NVR',
	})
	@Expose({ name: 'protect_device_id' })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	protectDeviceId?: string;

	@ApiPropertyOptional({
		name: 'protect_model_key',
		description: 'Protect model key of the device (camera, sensor, light, ...)',
	})
	@Expose({ name: 'protect_model_key' })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	protectModelKey?: string;
}
