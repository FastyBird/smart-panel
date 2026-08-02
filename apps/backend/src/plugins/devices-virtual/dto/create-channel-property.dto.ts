import { Expose } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PermissionType } from '../../../modules/devices/devices.constants';
import { CreateChannelPropertyDto } from '../../../modules/devices/dto/create-channel-property.dto';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { VirtualValueOrigin } from '../entities/devices-virtual.entity';
import { ValidateOwnedPropertyHasNoSource } from '../validators/owned-property-has-no-source-constraint.validator';
import { ValidateOwnedPropertyNotWritable } from '../validators/owned-property-not-writable-constraint.validator';
import { ValidateSourceNotVirtual } from '../validators/source-not-virtual-constraint.validator';

@ApiSchema({ name: 'DevicesVirtualPluginCreateChannelProperty' })
export class CreateVirtualChannelPropertyDto extends CreateChannelPropertyDto {
	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_VIRTUAL_TYPE,
		example: DEVICES_VIRTUAL_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel property type string."}]' })
	readonly type: typeof DEVICES_VIRTUAL_TYPE;

	// v1 has no write semantics for an owned property, so a writable one is a control that can never
	// move anything — see ValidateOwnedPropertyNotWritable and isUnsupportedOwnedPermissionsPair.
	//
	// Parent decorator stack repeated verbatim; class-validator replaces rather than merges. Without
	// @ArrayNotEmpty and @IsEnum restated here, a virtual property could be created with an empty or
	// nonsense permissions array that the generic DTO rejects.
	@ApiProperty({
		description: 'Property permissions',
		enum: PermissionType,
		isArray: true,
		example: [PermissionType.READ_ONLY],
	})
	@Expose()
	@IsArray()
	@IsEnum(PermissionType, {
		each: true,
		message: '[{"field":"permissions","reason":"Each permission must be a valid permission type."}]',
	})
	@ArrayNotEmpty({ message: '[{"field":"permissions","reason":"Permissions array cannot be empty."}]' })
	@ValidateOwnedPropertyNotWritable()
	permissions: PermissionType[];

	@ApiPropertyOptional({
		name: 'value_origin',
		description:
			'Whether the value comes from a source property or is stored by this property itself. Defaults to source.',
		enum: VirtualValueOrigin,
		default: VirtualValueOrigin.SOURCE,
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
			'Property whose value this one should project. Must be omitted or null when value_origin is local — an owned property stores its own value and has no source.',
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
