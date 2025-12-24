import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';

// =============================================================================
// Entity Override DTO
// =============================================================================

@ApiSchema({ name: 'DevicesZigbee2mqttPluginMappingExposeOverride' })
export class MappingExposeOverrideDto {
	@ApiProperty({
		description: 'The Z2M expose property name to override',
		example: 'temperature',
		name: 'expose_name',
	})
	@Expose({ name: 'expose_name' })
	@IsString()
	exposeName: string;

	@ApiPropertyOptional({
		description: 'Override the channel category for this expose',
		enum: ChannelCategory,
		enumName: 'DevicesModuleChannelCategory',
		name: 'channel_category',
	})
	@Expose({ name: 'channel_category' })
	@IsOptional()
	@IsEnum(ChannelCategory)
	channelCategory?: ChannelCategory;

	@ApiPropertyOptional({
		description: 'Skip this expose during adoption',
		default: false,
	})
	@Expose()
	@IsOptional()
	@IsBoolean()
	skip?: boolean;
}

// =============================================================================
// Mapping Preview Request DTO
// =============================================================================

@ApiSchema({ name: 'DevicesZigbee2mqttPluginMappingPreviewRequest' })
export class MappingPreviewRequestDto {
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
		description: 'Override entity mappings',
		type: () => [MappingExposeOverrideDto],
		name: 'expose_overrides',
	})
	@Expose({ name: 'expose_overrides' })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => MappingExposeOverrideDto)
	exposeOverrides?: MappingExposeOverrideDto[];
}

// =============================================================================
// Adopt Device Request DTO
// =============================================================================

@ApiSchema({ name: 'DevicesZigbee2mqttPluginAdoptPropertyDefinition' })
export class AdoptPropertyDefinitionDto {
	@ApiProperty({
		description: 'Property category',
		enum: PropertyCategory,
		enumName: 'DevicesModulePropertyCategory',
	})
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

	@ApiPropertyOptional({
		description: 'Property unit',
		example: '°C',
	})
	@Expose()
	@IsOptional()
	@IsString()
	unit?: string | null;

	@ApiPropertyOptional({
		description: 'Property format',
	})
	@Expose()
	@IsOptional()
	format?: string[] | number[] | null;

	@ApiProperty({
		description: 'Z2M expose property name (for binding)',
		example: 'temperature',
		name: 'z2m_property',
	})
	@Expose({ name: 'z2m_property' })
	@IsString()
	z2mProperty: string;
}

@ApiSchema({ name: 'DevicesZigbee2mqttPluginAdoptChannelDefinition' })
export class AdoptChannelDefinitionDto {
	@ApiProperty({
		description: 'Channel category',
		enum: ChannelCategory,
		enumName: 'DevicesModuleChannelCategory',
	})
	@Expose()
	@IsEnum(ChannelCategory)
	category: ChannelCategory;

	@ApiProperty({
		description: 'Channel name',
		example: 'Temperature Sensor',
	})
	@Expose()
	@IsString()
	name: string;

	@ApiPropertyOptional({
		description: 'Channel identifier (defaults to category)',
	})
	@Expose()
	@IsOptional()
	@IsString()
	identifier?: string;

	@ApiProperty({
		description: 'Channel properties',
		type: () => [AdoptPropertyDefinitionDto],
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => AdoptPropertyDefinitionDto)
	properties: AdoptPropertyDefinitionDto[];
}

@ApiSchema({ name: 'DevicesZigbee2mqttPluginAdoptDeviceRequest' })
export class AdoptDeviceRequestDto {
	@ApiProperty({
		description: 'IEEE address of the Z2M device to adopt',
		example: '0xa4c138e4f788f9fe',
		name: 'ieee_address',
	})
	@Expose({ name: 'ieee_address' })
	@IsString()
	ieeeAddress: string;

	@ApiProperty({
		description: 'Device name',
		example: 'Living Room Temperature Sensor',
	})
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({
		description: 'Device category',
		enum: DeviceCategory,
		enumName: 'DevicesModuleDeviceCategory',
	})
	@Expose()
	@IsEnum(DeviceCategory)
	category: DeviceCategory;

	@ApiPropertyOptional({
		description: 'Device description',
	})
	@Expose()
	@IsOptional()
	@IsString()
	description?: string;

	@ApiPropertyOptional({
		description: 'Enable device',
		default: true,
	})
	@Expose()
	@IsOptional()
	@IsBoolean()
	enabled?: boolean;

	@ApiProperty({
		description: 'Channel definitions for the device',
		type: () => [AdoptChannelDefinitionDto],
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => AdoptChannelDefinitionDto)
	channels: AdoptChannelDefinitionDto[];
}

// =============================================================================
// Request Wrapper DTOs (matching API convention with 'data' property)
// =============================================================================

@ApiSchema({ name: 'DevicesZigbee2mqttPluginReqMappingPreview' })
export class ReqMappingPreviewDto {
	@ApiPropertyOptional({
		description: 'Mapping preview request data',
		type: () => MappingPreviewRequestDto,
	})
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => MappingPreviewRequestDto)
	data?: MappingPreviewRequestDto;
}

@ApiSchema({ name: 'DevicesZigbee2mqttPluginReqAdoptDevice' })
export class ReqAdoptDeviceDto {
	@ApiProperty({
		description: 'Device adoption request data',
		type: () => AdoptDeviceRequestDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => AdoptDeviceRequestDto)
	data: AdoptDeviceRequestDto;
}
