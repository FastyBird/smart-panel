import { Type } from 'class-transformer';
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
	})
	@IsString()
	exposeName: string;

	@ApiPropertyOptional({
		description: 'Override the channel category for this expose',
		enum: ChannelCategory,
		enumName: 'DevicesModuleChannelCategory',
	})
	@IsOptional()
	@IsEnum(ChannelCategory)
	channelCategory?: ChannelCategory;

	@ApiPropertyOptional({
		description: 'Skip this expose during adoption',
		default: false,
	})
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
	})
	@IsOptional()
	@IsEnum(DeviceCategory)
	deviceCategory?: DeviceCategory;

	@ApiPropertyOptional({
		description: 'Override entity mappings',
		type: () => [MappingExposeOverrideDto],
	})
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
	@IsEnum(PropertyCategory)
	category: PropertyCategory;

	@ApiProperty({
		description: 'Property data type',
		enum: DataTypeType,
		enumName: 'DevicesModuleDataType',
	})
	@IsEnum(DataTypeType)
	dataType: DataTypeType;

	@ApiProperty({
		description: 'Property permissions',
		enum: PermissionType,
		enumName: 'DevicesModulePermissionType',
		isArray: true,
	})
	@IsArray()
	@IsEnum(PermissionType, { each: true })
	permissions: PermissionType[];

	@ApiPropertyOptional({
		description: 'Property unit',
		example: '°C',
	})
	@IsOptional()
	@IsString()
	unit?: string | null;

	@ApiPropertyOptional({
		description: 'Property format',
	})
	@IsOptional()
	format?: string[] | number[] | null;

	@ApiProperty({
		description: 'Z2M expose property name (for binding)',
		example: 'temperature',
	})
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
	@IsEnum(ChannelCategory)
	category: ChannelCategory;

	@ApiProperty({
		description: 'Channel name',
		example: 'Temperature Sensor',
	})
	@IsString()
	name: string;

	@ApiPropertyOptional({
		description: 'Channel identifier (defaults to category)',
	})
	@IsOptional()
	@IsString()
	identifier?: string;

	@ApiProperty({
		description: 'Channel properties',
		type: () => [AdoptPropertyDefinitionDto],
	})
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
	})
	@IsString()
	ieeeAddress: string;

	@ApiProperty({
		description: 'Device name',
		example: 'Living Room Temperature Sensor',
	})
	@IsString()
	name: string;

	@ApiProperty({
		description: 'Device category',
		enum: DeviceCategory,
		enumName: 'DevicesModuleDeviceCategory',
	})
	@IsEnum(DeviceCategory)
	category: DeviceCategory;

	@ApiPropertyOptional({
		description: 'Device description',
	})
	@IsOptional()
	@IsString()
	description?: string;

	@ApiPropertyOptional({
		description: 'Enable device',
		default: true,
	})
	@IsOptional()
	@IsBoolean()
	enabled?: boolean;

	@ApiProperty({
		description: 'Channel definitions for the device',
		type: () => [AdoptChannelDefinitionDto],
	})
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => AdoptChannelDefinitionDto)
	channels: AdoptChannelDefinitionDto[];
}
