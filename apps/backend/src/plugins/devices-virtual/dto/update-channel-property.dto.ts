import { Expose } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PermissionType } from '../../../modules/devices/devices.constants';
import { UpdateChannelPropertyDto } from '../../../modules/devices/dto/update-channel-property.dto';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { VirtualValueOrigin } from '../entities/devices-virtual.entity';
import { ValidateOwnedPropertyHasNoSource } from '../validators/owned-property-has-no-source-constraint.validator';
import { ValidateOwnedPropertyNotWritable } from '../validators/owned-property-not-writable-constraint.validator';
import { ValidateSourceNotVirtual } from '../validators/source-not-virtual-constraint.validator';

@ApiSchema({ name: 'DevicesVirtualPluginUpdateChannelProperty' })
export class UpdateVirtualChannelPropertyDto extends UpdateChannelPropertyDto {
	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_VIRTUAL_TYPE,
		example: DEVICES_VIRTUAL_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel property type string."}]' })
	type: typeof DEVICES_VIRTUAL_TYPE;

	// Same rule as on the create DTO — see CreateVirtualChannelPropertyDto.permissions. This catches
	// only the PATCH that sends both halves; `{permissions: ['rw']}` on its own is decided against the
	// stored row by VirtualDevicesService.assertOwnedPropertyNotWritable in the beforeUpdate hook.
	//
	// Parent decorator stack repeated verbatim; class-validator replaces rather than merges — and
	// @IsOptional in particular is dropped from a redeclared property whatever the child declares, so
	// omitting it would make permissions mandatory on every PATCH of a virtual property.
	@ApiPropertyOptional({
		description: 'Property permissions',
		enum: PermissionType,
		isArray: true,
		example: [PermissionType.READ_ONLY],
	})
	@Expose()
	@IsOptional()
	@IsArray()
	@IsEnum(PermissionType, {
		each: true,
		message: '[{"field":"permissions","reason":"Each permission must be a valid permission type."}]',
	})
	@ArrayNotEmpty({ message: '[{"field":"permissions","reason":"Permissions array cannot be empty."}]' })
	@ValidateOwnedPropertyNotWritable()
	permissions?: PermissionType[];

	@ApiPropertyOptional({
		name: 'value_origin',
		description: 'Whether the value comes from a source property or is stored by this property itself.',
		enum: VirtualValueOrigin,
		example: VirtualValueOrigin.SOURCE,
	})
	@Expose({ name: 'value_origin' })
	@IsOptional()
	@IsEnum(VirtualValueOrigin, {
		message: '[{"field":"value_origin","reason":"Value origin must be a valid value origin."}]',
	})
	value_origin?: VirtualValueOrigin;

	@ApiPropertyOptional({
		name: 'source_property',
		description:
			'Property whose value this one should project. Send to remap an orphaned property to a new source. Must be omitted or null when value_origin is local — an owned property stores its own value and has no source.',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose({ name: 'source_property' })
	@IsOptional()
	@IsUUID('4', {
		message: '[{"field":"source_property","reason":"Source property must be a valid UUID (version 4)."}]',
	})
	@ValidateIf((_, value) => value !== null)
	@ValidateSourceNotVirtual()
	@ValidateOwnedPropertyHasNoSource()
	source_property?: string | null;
}
