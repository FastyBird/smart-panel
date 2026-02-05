import { Expose, Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsNotEmpty,
	IsOptional,
	IsString,
	ValidateIf,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';

// ============================================================================
// Request DTOs
// ============================================================================

@ApiSchema({ name: 'DevicesHomeAssistantPluginHelperMappingPreviewRequest' })
export class HelperMappingPreviewRequestDto {
	@ApiPropertyOptional({
		description: 'Override device category',
		enum: DeviceCategory,
		name: 'device_category',
	})
	@Expose({ name: 'device_category' })
	@IsOptional()
	@IsEnum(DeviceCategory)
	deviceCategory?: DeviceCategory;

	@ApiPropertyOptional({
		description: 'Override channel category',
		enum: ChannelCategory,
		name: 'channel_category',
	})
	@Expose({ name: 'channel_category' })
	@IsOptional()
	@IsEnum(ChannelCategory)
	channelCategory?: ChannelCategory;
}

// ============================================================================
// Adopt Helper Request DTOs
// ============================================================================

@ApiSchema({ name: 'DevicesHomeAssistantPluginAdoptHelperPropertyDefinition' })
export class AdoptHelperPropertyDefinitionDto {
	@ApiProperty({
		description: 'Property category',
		enum: PropertyCategory,
	})
	@Expose()
	@IsEnum(PropertyCategory)
	category: PropertyCategory;

	@ApiProperty({
		description: 'Home Assistant attribute to bind',
		type: 'string',
		name: 'ha_attribute',
	})
	@Expose({ name: 'ha_attribute' })
	@IsString()
	haAttribute: string;

	@ApiProperty({
		description: 'Data type',
		enum: DataTypeType,
		name: 'data_type',
	})
	@Expose({ name: 'data_type' })
	@IsEnum(DataTypeType)
	dataType: DataTypeType;

	@ApiProperty({
		description: 'Permissions',
		type: [String],
		enum: PermissionType,
		isArray: true,
	})
	@Expose()
	@IsArray()
	@IsEnum(PermissionType, { each: true })
	permissions: PermissionType[];

	@ApiPropertyOptional({
		description: 'Format (enum values or numeric range)',
		type: 'array',
		items: { oneOf: [{ type: 'string' }, { type: 'number' }] },
		nullable: true,
	})
	@Expose()
	@IsOptional()
	format?: (string | number)[] | null;
}

@ApiSchema({ name: 'DevicesHomeAssistantPluginAdoptHelperChannelDefinition' })
export class AdoptHelperChannelDefinitionDto {
	@ApiProperty({
		description: 'Channel category',
		enum: ChannelCategory,
	})
	@Expose()
	@IsEnum(ChannelCategory)
	category: ChannelCategory;

	@ApiProperty({
		description: 'Channel name',
		type: 'string',
	})
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({
		description: 'Property definitions',
		type: [AdoptHelperPropertyDefinitionDto],
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => AdoptHelperPropertyDefinitionDto)
	properties: AdoptHelperPropertyDefinitionDto[];
}

@ApiSchema({ name: 'DevicesHomeAssistantPluginAdoptHelperRequest' })
export class AdoptHelperRequestDto {
	@ApiProperty({
		description: 'Home Assistant helper entity ID',
		type: 'string',
		name: 'entity_id',
	})
	@Expose({ name: 'entity_id' })
	@IsString()
	entityId: string;

	@ApiProperty({
		description: 'Device name',
		type: 'string',
	})
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({
		description: 'Device category',
		enum: DeviceCategory,
	})
	@Expose()
	@IsEnum(DeviceCategory)
	category: DeviceCategory;

	@ApiPropertyOptional({
		description: 'Device description',
		type: 'string',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"description","reason":"Description must be a valid string."}]' })
	@IsString({ message: '[{"field":"description","reason":"Description must be a valid string."}]' })
	@ValidateIf((_, value) => value !== null)
	description?: string | null;

	@ApiPropertyOptional({ description: 'Whether device is enabled', type: 'boolean', example: true })
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled attribute must be a valid true or false."}]' })
	enabled?: boolean;

	@ApiProperty({
		description: 'Channel definitions',
		type: [AdoptHelperChannelDefinitionDto],
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => AdoptHelperChannelDefinitionDto)
	channels: AdoptHelperChannelDefinitionDto[];
}
