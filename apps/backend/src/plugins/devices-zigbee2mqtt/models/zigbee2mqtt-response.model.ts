import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';

// ============================================================================
// Discovered Device Model
// ============================================================================

@ApiSchema({ name: 'DevicesZigbee2mqttPluginDataZ2mExposeInfo' })
export class Z2mExposeInfoModel {
	@ApiProperty({
		description: 'Expose type',
		type: 'string',
		example: 'numeric',
	})
	@Expose()
	@IsString()
	type: string;

	@ApiPropertyOptional({
		description: 'Expose name',
		type: 'string',
		example: 'temperature',
	})
	@Expose()
	@IsOptional()
	@IsString()
	name?: string;

	@ApiPropertyOptional({
		description: 'Expose property key',
		type: 'string',
		example: 'temperature',
	})
	@Expose()
	@IsOptional()
	@IsString()
	property?: string;

	@ApiPropertyOptional({
		description: 'Expose label',
		type: 'string',
		example: 'Temperature',
	})
	@Expose()
	@IsOptional()
	@IsString()
	label?: string;

	@ApiPropertyOptional({
		description: 'Access bits (1=STATE, 2=SET, 4=GET)',
		type: 'number',
	})
	@Expose()
	@IsOptional()
	access?: number;

	@ApiPropertyOptional({
		description: 'Unit of measurement',
		type: 'string',
		example: '°C',
	})
	@Expose()
	@IsOptional()
	@IsString()
	unit?: string;
}

@ApiSchema({ name: 'DevicesZigbee2mqttPluginDataDiscoveredDevice' })
export class Zigbee2mqttDiscoveredDeviceModel {
	@ApiProperty({
		description: 'IEEE address of the device',
		type: 'string',
		name: 'ieee_address',
		example: '0xa4c138e4f788f9fe',
	})
	@Expose({ name: 'ieee_address' })
	@IsString()
	ieeeAddress: string;

	@ApiProperty({
		description: 'Friendly name of the device',
		type: 'string',
		name: 'friendly_name',
		example: 'hall-temperature-humidity',
	})
	@Expose({ name: 'friendly_name' })
	@IsString()
	friendlyName: string;

	@ApiProperty({
		description: 'Device type',
		type: 'string',
		example: 'EndDevice',
	})
	@Expose()
	@IsString()
	type: 'Router' | 'EndDevice';

	@ApiPropertyOptional({
		description: 'Model ID',
		type: 'string',
		name: 'model_id',
		example: 'TS0601',
	})
	@Expose({ name: 'model_id' })
	@IsOptional()
	@IsString()
	modelId?: string;

	@ApiPropertyOptional({
		description: 'Manufacturer',
		type: 'string',
		example: 'HOBEIAN',
	})
	@Expose()
	@IsOptional()
	@IsString()
	manufacturer?: string;

	@ApiPropertyOptional({
		description: 'Model name from definition',
		type: 'string',
		example: 'ZG-227Z',
	})
	@Expose()
	@IsOptional()
	@IsString()
	model?: string;

	@ApiPropertyOptional({
		description: 'Device description',
		type: 'string',
		example: 'Temperature and humidity sensor',
	})
	@Expose()
	@IsOptional()
	@IsString()
	description?: string;

	@ApiPropertyOptional({
		description: 'Power source',
		type: 'string',
		name: 'power_source',
		example: 'Battery',
	})
	@Expose({ name: 'power_source' })
	@IsOptional()
	@IsString()
	powerSource?: string;

	@ApiProperty({
		description: 'Whether the device is supported by Z2M',
		type: 'boolean',
	})
	@Expose()
	@IsBoolean()
	supported: boolean;

	@ApiProperty({
		description: 'Whether the device is available',
		type: 'boolean',
	})
	@Expose()
	@IsBoolean()
	available: boolean;

	@ApiProperty({
		description: 'Whether the device is already adopted',
		type: 'boolean',
	})
	@Expose()
	@IsBoolean()
	adopted: boolean;

	@ApiPropertyOptional({
		description: 'ID of the adopted device if already adopted',
		type: 'string',
		name: 'adopted_device_id',
	})
	@Expose({ name: 'adopted_device_id' })
	@IsOptional()
	@IsString()
	adoptedDeviceId?: string;

	@ApiProperty({
		description: 'Device exposes/capabilities',
		type: () => [Z2mExposeInfoModel],
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => Z2mExposeInfoModel)
	exposes: Z2mExposeInfoModel[];

	@ApiPropertyOptional({
		description: 'Suggested device category based on exposes',
		enum: DeviceCategory,
		enumName: 'DevicesModuleDeviceCategory',
		name: 'suggested_category',
	})
	@Expose({ name: 'suggested_category' })
	@IsOptional()
	@IsEnum(DeviceCategory)
	suggestedCategory?: DeviceCategory;
}

// ============================================================================
// Discovered Device Response Models
// ============================================================================

@ApiSchema({ name: 'DevicesZigbee2mqttPluginResDiscoveredDevice' })
export class Zigbee2mqttDiscoveredDeviceResponseModel extends BaseSuccessResponseModel<Zigbee2mqttDiscoveredDeviceModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => Zigbee2mqttDiscoveredDeviceModel,
	})
	@Expose()
	declare data: Zigbee2mqttDiscoveredDeviceModel;
}

@ApiSchema({ name: 'DevicesZigbee2mqttPluginResDiscoveredDevices' })
export class Zigbee2mqttDiscoveredDevicesResponseModel extends BaseSuccessResponseModel<
	Zigbee2mqttDiscoveredDeviceModel[]
> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => [Zigbee2mqttDiscoveredDeviceModel],
	})
	@Expose()
	declare data: Zigbee2mqttDiscoveredDeviceModel[];
}

// ============================================================================
// Property Mapping Preview
// ============================================================================

@ApiSchema({ name: 'DevicesZigbee2mqttPluginDataPropertyMappingPreview' })
export class Z2mPropertyMappingPreviewModel {
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
		description: 'Z2M expose property name',
		type: 'string',
		name: 'z2m_property',
	})
	@Expose({ name: 'z2m_property' })
	@IsString()
	z2mProperty: string;

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
	format: (string | number)[] | null;

	@ApiProperty({
		description: 'Whether this property is required for the channel',
		type: 'boolean',
	})
	@Expose()
	@IsBoolean()
	required: boolean;

	@ApiPropertyOptional({
		description: 'Current value from Z2M device state',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		nullable: true,
		name: 'current_value',
	})
	@Expose({ name: 'current_value' })
	currentValue: string | number | boolean | null;

	@ApiPropertyOptional({
		description: 'Value that indicates invalid/unavailable data',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		nullable: true,
	})
	@Expose()
	@IsOptional()
	invalid?: string | number | boolean | null;
}

// ============================================================================
// Channel Mapping Preview
// ============================================================================

@ApiSchema({ name: 'DevicesZigbee2mqttPluginDataSuggestedChannel' })
export class Z2mSuggestedChannelModel {
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
// Expose Mapping Preview
// ============================================================================

@ApiSchema({ name: 'DevicesZigbee2mqttPluginDataExposeMappingPreview' })
export class Z2mExposeMappingPreviewModel {
	@ApiProperty({
		description: 'Z2M expose name/property',
		type: 'string',
		name: 'expose_name',
	})
	@Expose({ name: 'expose_name' })
	@IsString()
	exposeName: string;

	@ApiProperty({
		description: 'Z2M expose type',
		type: 'string',
		name: 'expose_type',
	})
	@Expose({ name: 'expose_type' })
	@IsString()
	exposeType: string;

	@ApiProperty({
		description: 'Mapping status',
		enum: ['mapped', 'partial', 'unmapped', 'skipped'],
	})
	@Expose()
	@IsString()
	status: 'mapped' | 'partial' | 'unmapped' | 'skipped';

	@ApiPropertyOptional({
		description: 'Suggested channel mapping',
		type: () => Z2mSuggestedChannelModel,
		nullable: true,
		name: 'suggested_channel',
	})
	@Expose({ name: 'suggested_channel' })
	@IsOptional()
	@ValidateNested()
	@Type(() => Z2mSuggestedChannelModel)
	suggestedChannel: Z2mSuggestedChannelModel | null;

	@ApiProperty({
		description: 'Suggested property mappings',
		type: [Z2mPropertyMappingPreviewModel],
		name: 'suggested_properties',
	})
	@Expose({ name: 'suggested_properties' })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => Z2mPropertyMappingPreviewModel)
	suggestedProperties: Z2mPropertyMappingPreviewModel[];

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

@ApiSchema({ name: 'DevicesZigbee2mqttPluginDataMappingWarning' })
export class Z2mMappingWarningModel {
	@ApiProperty({
		description: 'Warning type',
		enum: [
			'missing_required_channel',
			'missing_required_property',
			'unsupported_expose',
			'unknown_expose_type',
			'device_not_available',
			'device_already_adopted',
		],
	})
	@Expose()
	@IsString()
	type:
		| 'missing_required_channel'
		| 'missing_required_property'
		| 'unsupported_expose'
		| 'unknown_expose_type'
		| 'device_not_available'
		| 'device_already_adopted';

	@ApiPropertyOptional({
		description: 'Related expose name',
		type: 'string',
		nullable: true,
		name: 'expose_name',
	})
	@Expose({ name: 'expose_name' })
	@IsOptional()
	@IsString()
	exposeName?: string;

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

@ApiSchema({ name: 'DevicesZigbee2mqttPluginDataSuggestedDevice' })
export class Z2mSuggestedDeviceModel {
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
// Z2M Device Info
// ============================================================================

@ApiSchema({ name: 'DevicesZigbee2mqttPluginDataZ2mDeviceInfo' })
export class Z2mDeviceInfoModel {
	@ApiProperty({
		description: 'IEEE address',
		type: 'string',
		name: 'ieee_address',
	})
	@Expose({ name: 'ieee_address' })
	@IsString()
	ieeeAddress: string;

	@ApiProperty({
		description: 'Friendly name',
		type: 'string',
		name: 'friendly_name',
	})
	@Expose({ name: 'friendly_name' })
	@IsString()
	friendlyName: string;

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

	@ApiPropertyOptional({
		description: 'Description',
		type: 'string',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	description: string | null;
}

// ============================================================================
// Mapping Preview (Data Model)
// ============================================================================

@ApiSchema({ name: 'DevicesZigbee2mqttPluginDataMappingPreview' })
export class Z2mMappingPreviewModel {
	@ApiProperty({
		description: 'Z2M device information',
		type: () => Z2mDeviceInfoModel,
		name: 'z2m_device',
	})
	@Expose({ name: 'z2m_device' })
	@ValidateNested()
	@Type(() => Z2mDeviceInfoModel)
	z2mDevice: Z2mDeviceInfoModel;

	@ApiProperty({
		description: 'Suggested Smart Panel device',
		type: () => Z2mSuggestedDeviceModel,
		name: 'suggested_device',
	})
	@Expose({ name: 'suggested_device' })
	@ValidateNested()
	@Type(() => Z2mSuggestedDeviceModel)
	suggestedDevice: Z2mSuggestedDeviceModel;

	@ApiProperty({
		description: 'Expose mapping previews',
		type: [Z2mExposeMappingPreviewModel],
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => Z2mExposeMappingPreviewModel)
	exposes: Z2mExposeMappingPreviewModel[];

	@ApiProperty({
		description: 'Mapping warnings',
		type: [Z2mMappingWarningModel],
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => Z2mMappingWarningModel)
	warnings: Z2mMappingWarningModel[];

	@ApiProperty({
		description: 'Whether the mapping is ready for adoption (all required elements are mapped)',
		type: 'boolean',
		name: 'ready_to_adopt',
	})
	@Expose({ name: 'ready_to_adopt' })
	@IsBoolean()
	readyToAdopt: boolean;
}

// ============================================================================
// Mapping Preview Response Model
// ============================================================================

@ApiSchema({ name: 'DevicesZigbee2mqttPluginResMappingPreview' })
export class Z2mMappingPreviewResponseModel extends BaseSuccessResponseModel<Z2mMappingPreviewModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => Z2mMappingPreviewModel,
	})
	@Expose()
	declare data: Z2mMappingPreviewModel;
}
