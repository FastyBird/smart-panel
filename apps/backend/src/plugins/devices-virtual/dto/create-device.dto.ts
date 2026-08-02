import { Expose, Transform, Type } from 'class-transformer';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { CreateDeviceDto } from '../../../modules/devices/dto/create-device.dto';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { ValidateCategoryAllowed } from '../validators/category-allowed-constraint.validator';

import { CreateVirtualDeviceChannelDto } from './create-device-channel.dto';

@ApiSchema({ name: 'DevicesVirtualPluginCreateDevice' })
export class CreateVirtualDeviceDto extends CreateDeviceDto {
	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_VIRTUAL_TYPE,
		example: DEVICES_VIRTUAL_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	readonly type: typeof DEVICES_VIRTUAL_TYPE;

	// Redeclared (not just decorated further): class-validator does not merge a subclass property's
	// decorators with its parent's for the same property name — it replaces them. Every validator
	// CreateDeviceDto.category carries (@IsNotEmpty, @IsEnum) is repeated here verbatim so that
	// contract survives, with @ValidateCategoryAllowed appended as the one virtual-specific addition.
	@ApiProperty({ description: 'Device category', enum: DeviceCategory, example: DeviceCategory.GENERIC })
	@Expose()
	@IsNotEmpty({
		message: '[{"field":"category","reason":"Category must be a valid device category."}]',
	})
	@IsEnum(DeviceCategory, {
		message: '[{"field":"category","reason":"Category must be a valid device category."}]',
	})
	@ValidateCategoryAllowed()
	category: DeviceCategory;

	// Redeclared for the element class alone. `@Type` metadata is inherited like everything else, so
	// without this the nested objects are built as CreateDeviceChannelDto / CreateDeviceChannelPropertyDto
	// — the generic classes, which have no decorated `source_property` or `value_origin`. Validation runs
	// with `whitelist: true` + `forbidNonWhitelisted: true`, so those two fields were not merely ignored
	// but rejected outright ("property source_property should not exist"), before
	// ChannelsPropertiesTypeMapperService ever got to pick CreateVirtualChannelPropertyDto for the actual
	// insert. Creating a virtual device and its wiring in one POST — the shape the whole nested-creation
	// ordering in VirtualDeviceInformationListener and VirtualIndexMaintenanceListener exists to serve —
	// was therefore impossible; only the three-request sequence (device, then channel, then property)
	// worked.
	//
	// The same retyping is repeated on CreateVirtualDeviceChannelDto.properties and on
	// CreateVirtualChannelDto.properties, because a nested channel is re-validated a second time by
	// ChannelsService.create() against whichever DTO the *channel* mapping names.
	//
	// Every validator CreateDeviceDto.channels carries is repeated verbatim: class-validator replaces a
	// redeclared property's decorator stack rather than merging it with the parent's, so anything left
	// out here would be silently dropped rather than inherited.
	@ApiPropertyOptional({
		description: 'Device channels',
		type: 'array',
		items: { $ref: getSchemaPath(CreateVirtualDeviceChannelDto) },
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsArray({ message: '[{"field":"channels","reason":"Channels must be an array."}]' })
	@ValidateNested({ each: true })
	@Type(() => CreateVirtualDeviceChannelDto)
	channels?: CreateVirtualDeviceChannelDto[];
}
