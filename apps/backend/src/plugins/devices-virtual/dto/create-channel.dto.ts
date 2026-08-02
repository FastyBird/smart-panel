import { Expose, Transform, Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { CreateChannelDto } from '../../../modules/devices/dto/create-channel.dto';
import { ValidateDeviceExists } from '../../../modules/devices/validators/device-exists-constraint.validator';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { ValidateDeviceIsVirtual } from '../validators/device-is-virtual-constraint.validator';

import { CreateVirtualChannelPropertyDto } from './create-channel-property.dto';

@ApiSchema({ name: 'DevicesVirtualPluginCreateChannel' })
export class CreateVirtualChannelDto extends CreateChannelDto {
	@ApiProperty({
		description: 'Channel type',
		type: 'string',
		default: DEVICES_VIRTUAL_TYPE,
		example: DEVICES_VIRTUAL_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel type string."}]' })
	readonly type: typeof DEVICES_VIRTUAL_TYPE;

	// Containment, one level above the channel-property guard: a virtual channel may only hang off a
	// virtual device. Without this, `POST /channels` with `device: <physical device id>` gave a
	// physical device a virtual channel, which could then be filled with virtual properties — and a
	// virtual property whose owning device is physical is what lets VirtualStatusListener overwrite
	// that real device's connectivity (see VirtualDevicesService.assertChannelOwnerIsVirtual).
	//
	// Declaring it here covers all three creation paths, because every one of them validates against
	// this class with `device` populated: the standalone route takes it from the payload, the
	// device-scoped route merges the route parameter in first, and DevicesService.create() sets it to
	// the new device's id when it re-validates each nested channel.
	//
	// Parent decorator stack repeated verbatim; class-validator replaces rather than merges. Dropping
	// @ValidateDeviceExists here would not merely lose a nicer message — it is the only thing that
	// rejects an unknown device id on this route.
	@ApiProperty({
		description: 'Device ID',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateDeviceExists({ message: '[{"field":"device","reason":"The specified device does not exist."}]' })
	@ValidateDeviceIsVirtual()
	device: string;

	// Retyped for the same reason as CreateVirtualDeviceDto.channels — see that field's comment.
	//
	// This class is the *second* gate on a virtual device created with its wiring nested in one POST,
	// not merely the DTO for `POST /channels`: DevicesService.create() hands each nested channel to
	// ChannelsService.create(), which re-validates it against whatever the channel type mapping names —
	// this class — with `properties` still attached. So retyping only the device DTO's `channels` would
	// move the rejection one level down rather than remove it.
	//
	// Parent decorator stack repeated verbatim; class-validator replaces rather than merges.
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
