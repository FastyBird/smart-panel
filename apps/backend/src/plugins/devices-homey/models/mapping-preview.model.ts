import { Expose, Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsIn,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	Min,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { HomeyMappingDirection, HomeyMappingScalar, HomeyMappingSource } from '../mappings/mapping.types';

export enum HomeyMappingPreviewWarningSeverity {
	WARNING = 'warning',
	ERROR = 'error',
}

export enum HomeyMappingPreviewWarningCode {
	UNSUPPORTED_DEVICE = 'unsupported_device',
	NO_CHANNEL_MAPPING = 'no_channel_mapping',
	NO_PROPERTY_MAPPING = 'no_property_mapping',
	UNSUPPORTED_CAPABILITY = 'unsupported_capability',
	ORPHANED_PROPERTY_MAPPING = 'orphaned_property_mapping',
	DEVICE_MAPPING_CONFLICT = 'device_mapping_conflict',
	CHANNEL_MAPPING_CONFLICT = 'channel_mapping_conflict',
	PROPERTY_MAPPING_CONFLICT = 'property_mapping_conflict',
	DEVICE_UNAVAILABLE = 'device_unavailable',
	CAPABILITY_UNAVAILABLE = 'capability_unavailable',
	VALUE_UNAVAILABLE = 'value_unavailable',
	ACCESS_MISMATCH = 'access_mismatch',
	VALUE_CONVERSION_FAILED = 'value_conversion_failed',
	LOSSY_CONVERSION = 'lossy_conversion',
	AMBIGUOUS_CONVERSION = 'ambiguous_conversion',
	NON_REVERSIBLE_CONVERSION = 'non_reversible_conversion',
	INCOMPLETE_CAPABILITY_DOMAIN = 'incomplete_capability_domain',
	INVALID_CAPABILITY_VALUE_DOMAIN = 'invalid_capability_value_domain',
	INVALID_PROPERTY_VALUE_DOMAIN = 'invalid_property_value_domain',
	INVALID_DEVICE_CATEGORY = 'invalid_device_category',
}

export enum HomeyMappingPreviewWarningScope {
	DEVICE = 'device',
	CHANNEL = 'channel',
	CAPABILITY = 'capability',
	CONVERSION = 'conversion',
}

export enum HomeyMappingConversionType {
	IDENTITY = 'identity',
	SCALE = 'scale',
	MAP = 'map',
	BOOLEAN = 'boolean',
	CLAMP = 'clamp',
	ROUND = 'round',
	CONSTANT = 'constant',
	THRESHOLD = 'threshold',
	THRESHOLDS = 'thresholds',
}

@ApiSchema({ name: 'DevicesHomeyPluginDataMappingPreviewRange' })
export class HomeyMappingPreviewRangeModel {
	@ApiPropertyOptional({ description: 'Minimum value', nullable: true })
	@Expose()
	@IsOptional()
	@IsNumber()
	minimum: number | null;

	@ApiPropertyOptional({ description: 'Maximum value', nullable: true })
	@Expose()
	@IsOptional()
	@IsNumber()
	maximum: number | null;

	@ApiPropertyOptional({ description: 'Value step', nullable: true })
	@Expose()
	@IsOptional()
	@IsNumber()
	step: number | null;
}

@ApiSchema({ name: 'DevicesHomeyPluginDataMappingPreviewConversion' })
export class HomeyMappingPreviewConversionModel {
	@ApiProperty({ description: 'Configured value conversion', enum: HomeyMappingConversionType })
	@Expose()
	@IsEnum(HomeyMappingConversionType)
	type: HomeyMappingConversionType;

	@ApiProperty({ description: 'Whether the conversion is exactly reversible for its declared value domain' })
	@Expose()
	@IsBoolean()
	reversible: boolean;

	@ApiProperty({ description: 'Whether distinct source values can collapse to the same panel value' })
	@Expose()
	@IsBoolean()
	lossy: boolean;

	@ApiProperty({ description: 'Whether the configured conversion has multiple possible inverse values' })
	@Expose()
	@IsBoolean()
	ambiguous: boolean;

	@ApiPropertyOptional({
		name: 'input_range',
		description: 'Configured conversion input range',
		type: [Number],
		nullable: true,
	})
	@Expose({ name: 'input_range' })
	@IsOptional()
	@IsArray()
	@IsNumber({}, { each: true })
	inputRange: number[] | null;

	@ApiPropertyOptional({
		name: 'output_range',
		description: 'Configured conversion output range',
		type: [Number],
		nullable: true,
	})
	@Expose({ name: 'output_range' })
	@IsOptional()
	@IsArray()
	@IsNumber({}, { each: true })
	outputRange: number[] | null;

	@ApiPropertyOptional({ description: 'Whether a scale conversion clamps out-of-range input', nullable: true })
	@Expose()
	@IsOptional()
	@IsBoolean()
	clamp: boolean | null;

	@ApiPropertyOptional({ description: 'Configured clamp minimum', nullable: true })
	@Expose()
	@IsOptional()
	@IsNumber()
	minimum: number | null;

	@ApiPropertyOptional({ description: 'Configured clamp maximum', nullable: true })
	@Expose()
	@IsOptional()
	@IsNumber()
	maximum: number | null;

	@ApiPropertyOptional({ description: 'Configured rounding precision', nullable: true })
	@Expose()
	@IsOptional()
	@IsInt()
	@Min(0)
	precision: number | null;

	@ApiPropertyOptional({ name: 'read_table_size', description: 'Number of explicit read mappings', nullable: true })
	@Expose({ name: 'read_table_size' })
	@IsOptional()
	@IsInt()
	@Min(0)
	readTableSize: number | null;

	@ApiPropertyOptional({ name: 'write_table_size', description: 'Number of explicit write mappings', nullable: true })
	@Expose({ name: 'write_table_size' })
	@IsOptional()
	@IsInt()
	@Min(0)
	writeTableSize: number | null;
}

@ApiSchema({ name: 'DevicesHomeyPluginDataMappingPreviewProperty' })
export class HomeyMappingPreviewPropertyModel {
	@ApiProperty({ name: 'capability_id', description: 'Full authoritative Homey capability identifier' })
	@Expose({ name: 'capability_id' })
	@IsString()
	capabilityId: string;

	@ApiProperty({
		name: 'capability_base_id',
		description: 'Capability base identifier used only for descriptor matching',
	})
	@Expose({ name: 'capability_base_id' })
	@IsString()
	capabilityBaseId: string;

	@ApiProperty({ name: 'mapping_name', description: 'Resolved mapping descriptor name' })
	@Expose({ name: 'mapping_name' })
	@IsString()
	mappingName: string;

	@ApiProperty({ name: 'mapping_source', description: 'Resolved mapping descriptor source', enum: ['builtin', 'user'] })
	@Expose({ name: 'mapping_source' })
	@IsIn(['builtin', 'user'])
	mappingSource: HomeyMappingSource;

	@ApiProperty({ description: 'Smart Panel property category', enum: PropertyCategory })
	@Expose()
	@IsEnum(PropertyCategory)
	category: PropertyCategory;

	@ApiProperty({ name: 'data_type', description: 'Smart Panel property data type', enum: DataTypeType })
	@Expose({ name: 'data_type' })
	@IsEnum(DataTypeType)
	dataType: DataTypeType;

	@ApiProperty({ description: 'Declared mapping direction', enum: ['read_only', 'write_only', 'bidirectional'] })
	@Expose()
	@IsIn(['read_only', 'write_only', 'bidirectional'])
	direction: HomeyMappingDirection;

	@ApiProperty({
		description: 'Effective Smart Panel permissions after intersecting mapping and Homey access',
		enum: PermissionType,
		isArray: true,
	})
	@Expose()
	@IsArray()
	@IsEnum(PermissionType, { each: true })
	permissions: PermissionType[];

	@ApiProperty({ description: 'Whether the mapped capability is effectively readable' })
	@Expose()
	@IsBoolean()
	readable: boolean;

	@ApiProperty({ description: 'Whether the mapped capability is effectively writable' })
	@Expose()
	@IsBoolean()
	writable: boolean;

	@ApiPropertyOptional({ description: 'Mapped property unit', nullable: true })
	@Expose()
	@IsOptional()
	@IsString()
	unit: string | null;

	@ApiPropertyOptional({
		description: 'Mapped panel-side value range',
		type: HomeyMappingPreviewRangeModel,
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => HomeyMappingPreviewRangeModel)
	range: HomeyMappingPreviewRangeModel | null;

	@ApiPropertyOptional({
		name: 'source_range',
		description: 'Normalized Homey capability range',
		type: HomeyMappingPreviewRangeModel,
		nullable: true,
	})
	@Expose({ name: 'source_range' })
	@IsOptional()
	@ValidateNested()
	@Type(() => HomeyMappingPreviewRangeModel)
	sourceRange: HomeyMappingPreviewRangeModel | null;

	@ApiProperty({ name: 'enum_values', description: 'Normalized enum identifiers accepted by Homey', type: [String] })
	@Expose({ name: 'enum_values' })
	@IsArray()
	@IsString({ each: true })
	enumValues: string[];

	@ApiPropertyOptional({
		name: 'current_value',
		description: 'Current value transformed into Smart Panel representation',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		nullable: true,
	})
	@Expose({ name: 'current_value' })
	currentValue: HomeyMappingScalar;

	@ApiProperty({ name: 'value_available', description: 'Whether a readable current value could be transformed' })
	@Expose({ name: 'value_available' })
	@IsBoolean()
	valueAvailable: boolean;

	@ApiPropertyOptional({
		name: 'capability_available',
		description: 'Capability-specific availability when reported',
		nullable: true,
	})
	@Expose({ name: 'capability_available' })
	@IsOptional()
	@IsBoolean()
	capabilityAvailable: boolean | null;

	@ApiProperty({ description: 'Resolved conversion metadata', type: HomeyMappingPreviewConversionModel })
	@Expose()
	@ValidateNested()
	@Type(() => HomeyMappingPreviewConversionModel)
	conversion: HomeyMappingPreviewConversionModel;
}

@ApiSchema({ name: 'DevicesHomeyPluginDataMappingPreviewChannel' })
export class HomeyMappingPreviewChannelModel {
	@ApiProperty({ description: 'Stable channel mapping identifier' })
	@Expose()
	@IsString()
	identifier: string;

	@ApiProperty({ name: 'mapping_name', description: 'Resolved channel mapping descriptor name' })
	@Expose({ name: 'mapping_name' })
	@IsString()
	mappingName: string;

	@ApiProperty({ name: 'mapping_source', description: 'Resolved mapping descriptor source', enum: ['builtin', 'user'] })
	@Expose({ name: 'mapping_source' })
	@IsIn(['builtin', 'user'])
	mappingSource: HomeyMappingSource;

	@ApiProperty({ description: 'Smart Panel channel category', enum: ChannelCategory })
	@Expose()
	@IsEnum(ChannelCategory)
	category: ChannelCategory;

	@ApiProperty({ description: 'Suggested Smart Panel channel name' })
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({ description: 'Proposed mapped properties', type: [HomeyMappingPreviewPropertyModel] })
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => HomeyMappingPreviewPropertyModel)
	properties: HomeyMappingPreviewPropertyModel[];
}

@ApiSchema({ name: 'DevicesHomeyPluginDataMappingPreviewWarning' })
export class HomeyMappingPreviewWarningModel {
	@ApiProperty({ description: 'Stable warning code', enum: HomeyMappingPreviewWarningCode })
	@Expose()
	@IsEnum(HomeyMappingPreviewWarningCode)
	code: HomeyMappingPreviewWarningCode;

	@ApiProperty({ description: 'Whether the finding blocks adoption', enum: HomeyMappingPreviewWarningSeverity })
	@Expose()
	@IsEnum(HomeyMappingPreviewWarningSeverity)
	severity: HomeyMappingPreviewWarningSeverity;

	@ApiProperty({ description: 'Finding scope', enum: HomeyMappingPreviewWarningScope })
	@Expose()
	@IsEnum(HomeyMappingPreviewWarningScope)
	scope: HomeyMappingPreviewWarningScope;

	@ApiPropertyOptional({ description: 'Related stable device, channel, or capability identifier', nullable: true })
	@Expose()
	@IsOptional()
	@IsString()
	identifier: string | null;

	@ApiProperty({ name: 'mapping_names', description: 'Related mapping descriptor names', type: [String] })
	@Expose({ name: 'mapping_names' })
	@IsArray()
	@IsString({ each: true })
	mappingNames: string[];

	@ApiProperty({ description: 'Sanitized human-readable finding' })
	@Expose()
	@IsString()
	message: string;
}

@ApiSchema({ name: 'DevicesHomeyPluginDataMappingPreviewDevice' })
export class HomeyMappingPreviewDeviceModel {
	@ApiProperty({ description: 'Authoritative Homey device identifier' })
	@Expose()
	@IsString()
	id: string;

	@ApiProperty({ description: 'Homey device display name' })
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({ description: 'Normalized Homey device class' })
	@Expose()
	@IsString()
	class: string;

	@ApiPropertyOptional({ name: 'zone_id', description: 'Homey zone identifier', nullable: true })
	@Expose({ name: 'zone_id' })
	@IsOptional()
	@IsString()
	zoneId: string | null;

	@ApiProperty({ name: 'zone_path', description: 'Ordered root-to-leaf Homey zone names', type: [String] })
	@Expose({ name: 'zone_path' })
	@IsArray()
	@IsString({ each: true })
	zonePath: string[];

	@ApiProperty({ description: 'Whether Homey currently reports the device as available' })
	@Expose()
	@IsBoolean()
	available: boolean;
}

@ApiSchema({ name: 'DevicesHomeyPluginDataMappingPreview' })
export class HomeyMappingPreviewModel {
	@ApiProperty({ description: 'Fresh normalized Homey device metadata', type: HomeyMappingPreviewDeviceModel })
	@Expose()
	@ValidateNested()
	@Type(() => HomeyMappingPreviewDeviceModel)
	device: HomeyMappingPreviewDeviceModel;

	@ApiPropertyOptional({
		name: 'suggested_category',
		description: 'Category inferred by the resolved device mapping',
		enum: DeviceCategory,
		nullable: true,
	})
	@Expose({ name: 'suggested_category' })
	@IsOptional()
	@IsEnum(DeviceCategory)
	suggestedCategory: DeviceCategory | null;

	@ApiPropertyOptional({
		name: 'selected_category',
		description: 'Category validated by this preview',
		enum: DeviceCategory,
		nullable: true,
	})
	@Expose({ name: 'selected_category' })
	@IsOptional()
	@IsEnum(DeviceCategory)
	selectedCategory: DeviceCategory | null;

	@ApiProperty({
		name: 'valid_categories',
		description: 'Deterministically ordered categories compatible with the proposed structure',
		enum: DeviceCategory,
		isArray: true,
	})
	@Expose({ name: 'valid_categories' })
	@IsArray()
	@IsEnum(DeviceCategory, { each: true })
	validCategories: DeviceCategory[];

	@ApiProperty({ description: 'Proposed Smart Panel channels and properties', type: [HomeyMappingPreviewChannelModel] })
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => HomeyMappingPreviewChannelModel)
	channels: HomeyMappingPreviewChannelModel[];

	@ApiProperty({
		name: 'unsupported_capability_ids',
		description: 'Full Homey capability identifiers without a resolved property descriptor',
		type: [String],
	})
	@Expose({ name: 'unsupported_capability_ids' })
	@IsArray()
	@IsString({ each: true })
	unsupportedCapabilityIds: string[];

	@ApiProperty({ description: 'Deterministically ordered mapping findings', type: [HomeyMappingPreviewWarningModel] })
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => HomeyMappingPreviewWarningModel)
	warnings: HomeyMappingPreviewWarningModel[];

	@ApiProperty({ name: 'ready_to_adopt', description: 'Whether the selected structure has no blocking findings' })
	@Expose({ name: 'ready_to_adopt' })
	@IsBoolean()
	readyToAdopt: boolean;
}

@ApiSchema({ name: 'DevicesHomeyPluginResMappingPreview' })
export class HomeyMappingPreviewResponseModel extends BaseSuccessResponseModel<HomeyMappingPreviewModel> {
	@ApiProperty({ type: HomeyMappingPreviewModel })
	@Expose()
	declare data: HomeyMappingPreviewModel;
}
