import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';

// ============================================================================
// Property Mapping Preview
// ============================================================================

@ApiSchema({ name: 'DevicesHomeAssistantPluginPropertyMappingPreview' })
export class PropertyMappingPreviewModel {
	@ApiProperty({
		description: 'Property category',
		enum: PropertyCategory,
	})
	@Expose()
	@IsEnum(PropertyCategory)
	category: PropertyCategory;

	@ApiProperty({
		description: 'Property name',
		type: 'string',
	})
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({
		description: 'Bound Home Assistant attribute',
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
	unit: string | null;

	@ApiPropertyOptional({
		description: 'Format (enum values or numeric range)',
		type: 'array',
		items: { oneOf: [{ type: 'string' }, { type: 'number' }] },
		nullable: true,
	})
	@Expose()
	@IsOptional()
	format: (string | number)[] | null;

	@ApiProperty({
		description: 'Whether this property is required for the channel',
		type: 'boolean',
	})
	@Expose()
	@IsBoolean()
	required: boolean;

	@ApiPropertyOptional({
		description: 'Current value from Home Assistant',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		nullable: true,
		name: 'current_value',
	})
	@Expose({ name: 'current_value' })
	currentValue: string | number | boolean | null;
}

// ============================================================================
// Channel Mapping Preview
// ============================================================================

@ApiSchema({ name: 'DevicesHomeAssistantPluginSuggestedChannel' })
export class SuggestedChannelModel {
	@ApiProperty({
		description: 'Channel category',
		enum: ChannelCategory,
	})
	@Expose()
	@IsEnum(ChannelCategory)
	category: ChannelCategory;

	@ApiProperty({
		description: 'Suggested channel name',
		type: 'string',
	})
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({
		description: 'Mapping confidence level',
		enum: ['high', 'medium', 'low'],
	})
	@Expose()
	@IsString()
	confidence: 'high' | 'medium' | 'low';
}

// ============================================================================
// Entity Mapping Preview
// ============================================================================

@ApiSchema({ name: 'DevicesHomeAssistantPluginEntityMappingPreview' })
export class EntityMappingPreviewModel {
	@ApiProperty({
		description: 'Home Assistant entity ID',
		type: 'string',
		name: 'entity_id',
	})
	@Expose({ name: 'entity_id' })
	@IsString()
	entityId: string;

	@ApiProperty({
		description: 'Home Assistant domain',
		type: 'string',
	})
	@Expose()
	@IsString()
	domain: string;

	@ApiPropertyOptional({
		description: 'Home Assistant device class',
		type: 'string',
		nullable: true,
		name: 'device_class',
	})
	@Expose({ name: 'device_class' })
	@IsOptional()
	@IsString()
	deviceClass: string | null;

	@ApiPropertyOptional({
		description: 'Current state value',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		nullable: true,
		name: 'current_state',
	})
	@Expose({ name: 'current_state' })
	currentState: string | number | boolean | null;

	@ApiProperty({
		description: 'Entity attributes',
		type: 'object',
		additionalProperties: true,
	})
	@Expose()
	@IsObject()
	attributes: Record<string, unknown>;

	@ApiProperty({
		description: 'Mapping status',
		enum: ['mapped', 'partial', 'unmapped', 'skipped'],
	})
	@Expose()
	@IsString()
	status: 'mapped' | 'partial' | 'unmapped' | 'skipped';

	@ApiPropertyOptional({
		description: 'Suggested channel mapping',
		type: () => SuggestedChannelModel,
		nullable: true,
		name: 'suggested_channel',
	})
	@Expose({ name: 'suggested_channel' })
	@IsOptional()
	@ValidateNested()
	@Type(() => SuggestedChannelModel)
	suggestedChannel: SuggestedChannelModel | null;

	@ApiProperty({
		description: 'Suggested property mappings',
		type: [PropertyMappingPreviewModel],
		name: 'suggested_properties',
	})
	@Expose({ name: 'suggested_properties' })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PropertyMappingPreviewModel)
	suggestedProperties: PropertyMappingPreviewModel[];

	@ApiProperty({
		description: 'Attributes that could not be automatically mapped',
		type: [String],
		name: 'unmapped_attributes',
	})
	@Expose({ name: 'unmapped_attributes' })
	@IsArray()
	@IsString({ each: true })
	unmappedAttributes: string[];

	@ApiProperty({
		description: 'Required properties that are missing from mapping',
		type: [String],
		enum: PropertyCategory,
		isArray: true,
		name: 'missing_required_properties',
	})
	@Expose({ name: 'missing_required_properties' })
	@IsArray()
	@IsEnum(PropertyCategory, { each: true })
	missingRequiredProperties: PropertyCategory[];
}

// ============================================================================
// Mapping Warning
// ============================================================================

@ApiSchema({ name: 'DevicesHomeAssistantPluginMappingWarning' })
export class MappingWarningModel {
	@ApiProperty({
		description: 'Warning type',
		enum: ['missing_required_channel', 'missing_required_property', 'unsupported_entity', 'unknown_device_class'],
	})
	@Expose()
	@IsString()
	type: 'missing_required_channel' | 'missing_required_property' | 'unsupported_entity' | 'unknown_device_class';

	@ApiPropertyOptional({
		description: 'Related entity ID',
		type: 'string',
		nullable: true,
		name: 'entity_id',
	})
	@Expose({ name: 'entity_id' })
	@IsOptional()
	@IsString()
	entityId?: string;

	@ApiProperty({
		description: 'Warning message',
		type: 'string',
	})
	@Expose()
	@IsString()
	message: string;

	@ApiPropertyOptional({
		description: 'Suggested resolution',
		type: 'string',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	suggestion?: string;
}

// ============================================================================
// Suggested Device
// ============================================================================

@ApiSchema({ name: 'DevicesHomeAssistantPluginSuggestedDevice' })
export class SuggestedDeviceModel {
	@ApiProperty({
		description: 'Device category',
		enum: DeviceCategory,
	})
	@Expose()
	@IsEnum(DeviceCategory)
	category: DeviceCategory;

	@ApiProperty({
		description: 'Suggested device name',
		type: 'string',
	})
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({
		description: 'Mapping confidence level',
		enum: ['high', 'medium', 'low'],
	})
	@Expose()
	@IsString()
	confidence: 'high' | 'medium' | 'low';
}

// ============================================================================
// HA Device Info
// ============================================================================

@ApiSchema({ name: 'DevicesHomeAssistantPluginHaDeviceInfo' })
export class HaDeviceInfoModel {
	@ApiProperty({
		description: 'Home Assistant device ID',
		type: 'string',
	})
	@Expose()
	@IsString()
	id: string;

	@ApiProperty({
		description: 'Device name',
		type: 'string',
	})
	@Expose()
	@IsString()
	name: string;

	@ApiPropertyOptional({
		description: 'Manufacturer',
		type: 'string',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	manufacturer: string | null;

	@ApiPropertyOptional({
		description: 'Model',
		type: 'string',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	model: string | null;
}

// ============================================================================
// Mapping Preview Response
// ============================================================================

@ApiSchema({ name: 'DevicesHomeAssistantPluginMappingPreviewResponse' })
export class MappingPreviewResponseModel {
	@ApiProperty({
		description: 'Home Assistant device information',
		type: () => HaDeviceInfoModel,
		name: 'ha_device',
	})
	@Expose({ name: 'ha_device' })
	@ValidateNested()
	@Type(() => HaDeviceInfoModel)
	haDevice: HaDeviceInfoModel;

	@ApiProperty({
		description: 'Suggested Smart Panel device',
		type: () => SuggestedDeviceModel,
		name: 'suggested_device',
	})
	@Expose({ name: 'suggested_device' })
	@ValidateNested()
	@Type(() => SuggestedDeviceModel)
	suggestedDevice: SuggestedDeviceModel;

	@ApiProperty({
		description: 'Entity mapping previews',
		type: [EntityMappingPreviewModel],
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => EntityMappingPreviewModel)
	entities: EntityMappingPreviewModel[];

	@ApiProperty({
		description: 'Mapping warnings',
		type: [MappingWarningModel],
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => MappingWarningModel)
	warnings: MappingWarningModel[];

	@ApiProperty({
		description: 'Whether the mapping is ready for adoption (all required elements are mapped)',
		type: 'boolean',
		name: 'ready_to_adopt',
	})
	@Expose({ name: 'ready_to_adopt' })
	@IsBoolean()
	readyToAdopt: boolean;
}
