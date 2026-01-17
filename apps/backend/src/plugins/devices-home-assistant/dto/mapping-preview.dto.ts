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

@ApiSchema({ name: 'DevicesHomeAssistantPluginMappingEntityOverride' })
export class MappingEntityOverrideDto {
	@ApiProperty({
		description: 'Home Assistant entity ID to override',
		type: 'string',
		example: 'light.living_room',
		name: 'entity_id',
	})
	@Expose({ name: 'entity_id' })
	@IsString()
	entityId: string;

	@ApiPropertyOptional({
		description: 'Override channel category for this entity',
		enum: ChannelCategory,
		name: 'channel_category',
	})
	@Expose({ name: 'channel_category' })
	@IsOptional()
	@IsEnum(ChannelCategory)
	channelCategory?: ChannelCategory;

	@ApiPropertyOptional({
		description: 'Skip this entity from mapping',
		type: 'boolean',
		default: false,
	})
	@Expose()
	@IsOptional()
	@IsBoolean()
	skip?: boolean;
}

@ApiSchema({ name: 'DevicesHomeAssistantPluginMappingPreviewRequest' })
export class MappingPreviewRequestDto {
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
		description: 'Entity-specific overrides',
		type: [MappingEntityOverrideDto],
		name: 'entity_overrides',
	})
	@Expose({ name: 'entity_overrides' })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => MappingEntityOverrideDto)
	entityOverrides?: MappingEntityOverrideDto[];
}

// ============================================================================
// Adopt Device Request DTOs
// ============================================================================

@ApiSchema({ name: 'DevicesHomeAssistantPluginAdoptPropertyDefinition' })
export class AdoptPropertyDefinitionDto {
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
		description: 'Unit of measurement',
		type: 'string',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	unit?: string | null;

	@ApiPropertyOptional({
		description: 'Format (enum values or numeric range)',
		type: 'array',
		items: { oneOf: [{ type: 'string' }, { type: 'number' }] },
		nullable: true,
	})
	@Expose()
	@IsOptional()
	format?: (string | number)[] | null;

	@ApiPropertyOptional({
		description: 'Home Assistant entity ID for this property (used when consolidating channels)',
		type: 'string',
		nullable: true,
		name: 'ha_entity_id',
	})
	@Expose({ name: 'ha_entity_id' })
	@IsOptional()
	@IsString()
	haEntityId?: string | null;

	@ApiPropertyOptional({
		description: 'Transformer name for value conversion between HA and Smart Panel formats',
		type: 'string',
		nullable: true,
		name: 'ha_transformer',
	})
	@Expose({ name: 'ha_transformer' })
	@IsOptional()
	@IsString()
	haTransformer?: string | null;
}

@ApiSchema({ name: 'DevicesHomeAssistantPluginAdoptChannelDefinition' })
export class AdoptChannelDefinitionDto {
	@ApiProperty({
		description: 'Home Assistant entity ID',
		type: 'string',
		name: 'entity_id',
	})
	@Expose({ name: 'entity_id' })
	@IsString()
	entityId: string;

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
		type: [AdoptPropertyDefinitionDto],
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => AdoptPropertyDefinitionDto)
	properties: AdoptPropertyDefinitionDto[];
}

@ApiSchema({ name: 'DevicesHomeAssistantPluginAdoptDeviceRequest' })
export class AdoptDeviceRequestDto {
	@ApiProperty({
		description: 'Home Assistant device ID',
		type: 'string',
		name: 'ha_device_id',
	})
	@Expose({ name: 'ha_device_id' })
	@IsString()
	haDeviceId: string;

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
		type: [AdoptChannelDefinitionDto],
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => AdoptChannelDefinitionDto)
	channels: AdoptChannelDefinitionDto[];
}
