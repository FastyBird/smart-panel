import { Expose, Transform, Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { CreateDeviceChannelDto } from '../../../modules/devices/dto/create-device-channel.dto';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';

import { CreateVirtualChannelPropertyDto } from './create-channel-property.dto';

/**
 * A channel nested inside a virtual device's own creation request, as opposed to
 * CreateVirtualChannelDto which is POSTed to `/channels` on its own and therefore names its `device`.
 * It exists for the same reason DevicesModule keeps CreateDeviceChannelDto and CreateChannelDto
 * apart: the nested form has no `device` to give, because the device it belongs to is the one being
 * created around it.
 */
@ApiSchema({ name: 'DevicesVirtualPluginCreateDeviceChannel' })
export class CreateVirtualDeviceChannelDto extends CreateDeviceChannelDto {
	@ApiProperty({
		description: 'Channel type',
		type: 'string',
		default: DEVICES_VIRTUAL_TYPE,
		example: DEVICES_VIRTUAL_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel type string."}]' })
	readonly type: typeof DEVICES_VIRTUAL_TYPE;

	// Redeclared solely to retype the array's element class — see CreateVirtualDeviceDto.channels for
	// why inheriting `@Type(() => CreateDeviceChannelPropertyDto)` makes a nested linked property
	// unrepresentable. Every validator CreateDeviceChannelDto.properties carries is repeated verbatim,
	// because class-validator replaces a redeclared property's decorator stack rather than merging it.
	@ApiPropertyOptional({
		description: 'Channel properties',
		type: 'array',
		items: { $ref: getSchemaPath(CreateVirtualChannelPropertyDto) },
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsArray({ message: '[{"field":"properties","reason":"Properties must be an array."}]' })
	@ValidateNested({ each: true })
	@Type(() => CreateVirtualChannelPropertyDto)
	properties?: CreateVirtualChannelPropertyDto[];
}
