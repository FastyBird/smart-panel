import { Expose, Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsDefined,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	Max,
	Min,
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

// =============================================================================
// Expose Override DTO
// =============================================================================

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginMappingExposeOverride' })
export class ZhMappingExposeOverrideDto {
	@ApiProperty({ description: 'Expose property name to override', example: 'temperature', name: 'expose_name' })
	@Expose({ name: 'expose_name' })
	@IsString()
	exposeName: string;

	@ApiPropertyOptional({
		description: 'Override channel category',
		enum: ChannelCategory,
		enumName: 'DevicesModuleChannelCategory',
		name: 'channel_category',
	})
	@Expose({ name: 'channel_category' })
	@IsOptional()
	@IsEnum(ChannelCategory)
	channelCategory?: ChannelCategory;

	@ApiPropertyOptional({ description: 'Skip this expose during adoption', default: false })
	@Expose()
	@IsOptional()
	@IsBoolean()
	skip?: boolean;
}

// =============================================================================
// Mapping Preview Request DTO
// =============================================================================

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginMappingPreviewRequest' })
export class ZhMappingPreviewRequestDto {
	@ApiPropertyOptional({
		description: 'Override device category suggestion',
		enum: DeviceCategory,
		enumName: 'DevicesModuleDeviceCategory',
		name: 'device_category',
	})
	@Expose({ name: 'device_category' })
	@IsOptional()
	@IsEnum(DeviceCategory)
	deviceCategory?: DeviceCategory;

	@ApiPropertyOptional({
		description: 'Override expose mappings',
		type: () => [ZhMappingExposeOverrideDto],
		name: 'expose_overrides',
	})
	@Expose({ name: 'expose_overrides' })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ZhMappingExposeOverrideDto)
	exposeOverrides?: ZhMappingExposeOverrideDto[];
}

// =============================================================================
// Adopt Device Request DTO
// =============================================================================

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginAdoptPropertyDefinition' })
export class ZhAdoptPropertyDefinitionDto {
	@ApiProperty({ description: 'Property category', enum: PropertyCategory, enumName: 'DevicesModulePropertyCategory' })
	@Expose()
	@IsEnum(PropertyCategory)
	category: PropertyCategory;

	@ApiProperty({
		description: 'Property data type',
		enum: DataTypeType,
		enumName: 'DevicesModuleDataType',
		name: 'data_type',
	})
	@Expose({ name: 'data_type' })
	@IsEnum(DataTypeType)
	dataType: DataTypeType;

	@ApiProperty({
		description: 'Property permissions',
		enum: PermissionType,
		enumName: 'DevicesModulePermissionType',
		isArray: true,
	})
	@Expose()
	@IsArray()
	@IsEnum(PermissionType, { each: true })
	permissions: PermissionType[];

	@ApiPropertyOptional({ description: 'Property format' })
	@Expose()
	@IsOptional()
	format?: string[] | number[] | null;

	@ApiProperty({
		description: 'Zigbee expose property name',
		example: 'temperature',
		name: 'zigbee_property',
	})
	@Expose({ name: 'zigbee_property' })
	@IsString()
	zigbeeProperty: string;
}

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginAdoptChannelDefinition' })
export class ZhAdoptChannelDefinitionDto {
	@ApiProperty({
		description: 'Channel category',
		enum: ChannelCategory,
		enumName: 'DevicesModuleChannelCategory',
	})
	@Expose()
	@IsEnum(ChannelCategory)
	category: ChannelCategory;

	@ApiProperty({ description: 'Channel name', example: 'Temperature Sensor' })
	@Expose()
	@IsString()
	name: string;

	@ApiPropertyOptional({ description: 'Channel identifier' })
	@Expose()
	@IsOptional()
	@IsString()
	identifier?: string;

	@ApiProperty({ description: 'Channel properties', type: () => [ZhAdoptPropertyDefinitionDto] })
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ZhAdoptPropertyDefinitionDto)
	properties: ZhAdoptPropertyDefinitionDto[];
}

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginAdoptDeviceRequest' })
export class ZhAdoptDeviceRequestDto {
	@ApiProperty({
		description: 'IEEE address of the device to adopt',
		example: '0x00124b002216a490',
		name: 'ieee_address',
	})
	@Expose({ name: 'ieee_address' })
	@IsString()
	ieeeAddress: string;

	@ApiProperty({ description: 'Device name', example: 'Living Room Temperature Sensor' })
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({ description: 'Device category', enum: DeviceCategory, enumName: 'DevicesModuleDeviceCategory' })
	@Expose()
	@IsEnum(DeviceCategory)
	category: DeviceCategory;

	@ApiPropertyOptional({ description: 'Device description' })
	@Expose()
	@IsOptional()
	@IsString()
	description?: string;

	@ApiPropertyOptional({ description: 'Enable device', default: true })
	@Expose()
	@IsOptional()
	@IsBoolean()
	enabled?: boolean;

	@ApiProperty({ description: 'Channel definitions', type: () => [ZhAdoptChannelDefinitionDto] })
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ZhAdoptChannelDefinitionDto)
	channels: ZhAdoptChannelDefinitionDto[];
}

// =============================================================================
// Permit Join Request DTO
// =============================================================================

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginPermitJoinRequest' })
export class ZhPermitJoinRequestDto {
	@ApiProperty({ description: 'Enable or disable permit join', type: 'boolean' })
	@Expose()
	@IsBoolean()
	enabled: boolean;

	@ApiPropertyOptional({ description: 'Timeout in seconds (1-254)', type: 'number', minimum: 1, maximum: 254 })
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"timeout","reason":"Timeout must be a whole number."}]' })
	@Min(1, { message: '[{"field":"timeout","reason":"Timeout minimum value must be at least 1 second."}]' })
	@Max(254, { message: '[{"field":"timeout","reason":"Timeout maximum value must be at most 254 seconds."}]' })
	timeout?: number;
}

// =============================================================================
// Request Wrapper DTOs
// =============================================================================

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginReqMappingPreview' })
export class ReqZhMappingPreviewDto {
	@ApiPropertyOptional({ description: 'Mapping preview request data', type: () => ZhMappingPreviewRequestDto })
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => ZhMappingPreviewRequestDto)
	data?: ZhMappingPreviewRequestDto;
}

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginReqAdoptDevice' })
export class ReqZhAdoptDeviceDto {
	@ApiProperty({ description: 'Device adoption request data', type: () => ZhAdoptDeviceRequestDto })
	@Expose()
	@IsDefined({ message: '[{"field":"data","reason":"Request body must contain a data property."}]' })
	@ValidateNested()
	@Type(() => ZhAdoptDeviceRequestDto)
	data: ZhAdoptDeviceRequestDto;
}

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginReqPermitJoin' })
export class ReqZhPermitJoinDto {
	@ApiProperty({ description: 'Permit join request data', type: () => ZhPermitJoinRequestDto })
	@Expose()
	@IsDefined({ message: '[{"field":"data","reason":"Request body must contain a data property."}]' })
	@ValidateNested()
	@Type(() => ZhPermitJoinRequestDto)
	data: ZhPermitJoinRequestDto;
}
