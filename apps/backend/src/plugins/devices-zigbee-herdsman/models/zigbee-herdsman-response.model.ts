import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { InterviewStatus } from '../devices-zigbee-herdsman.constants';

// ============================================================================
// Expose Info Model
// ============================================================================

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginDataExposeInfo' })
export class ZhExposeInfoModel {
	@ApiProperty({ description: 'Expose type', type: 'string', example: 'numeric' })
	@Expose()
	@IsString()
	type: string;

	@ApiPropertyOptional({ description: 'Expose name', type: 'string', example: 'temperature' })
	@Expose()
	@IsOptional()
	@IsString()
	name?: string;

	@ApiPropertyOptional({ description: 'Expose property key', type: 'string', example: 'temperature' })
	@Expose()
	@IsOptional()
	@IsString()
	property?: string;

	@ApiPropertyOptional({ description: 'Expose label', type: 'string', example: 'Temperature' })
	@Expose()
	@IsOptional()
	@IsString()
	label?: string;

	@ApiPropertyOptional({ description: 'Access bits (1=STATE, 2=SET, 4=GET)', type: 'number' })
	@Expose()
	@IsOptional()
	access?: number;

	@ApiPropertyOptional({ description: 'Unit of measurement', type: 'string', example: '°C' })
	@Expose()
	@IsOptional()
	@IsString()
	unit?: string;
}

// ============================================================================
// Discovered Device Model
// ============================================================================

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginDataDiscoveredDevice' })
export class ZigbeeHerdsmanDiscoveredDeviceModel {
	@ApiProperty({
		description: 'IEEE address of the device',
		type: 'string',
		name: 'ieee_address',
		example: '0x00124b002216a490',
	})
	@Expose({ name: 'ieee_address' })
	@IsString()
	ieeeAddress: string;

	@ApiProperty({
		description: 'Friendly name of the device',
		type: 'string',
		name: 'friendly_name',
		example: 'Aqara Temp Sensor',
	})
	@Expose({ name: 'friendly_name' })
	@IsString()
	friendlyName: string;

	@ApiProperty({ description: 'Zigbee device type', type: 'string', example: 'EndDevice' })
	@Expose()
	@IsString()
	type: 'Coordinator' | 'Router' | 'EndDevice';

	@ApiPropertyOptional({ description: 'Model ID', type: 'string', name: 'model_id', example: 'WSDCGQ11LM' })
	@Expose({ name: 'model_id' })
	@IsOptional()
	@IsString()
	modelId?: string;

	@ApiPropertyOptional({ description: 'Manufacturer', type: 'string', example: 'Aqara' })
	@Expose()
	@IsOptional()
	@IsString()
	manufacturer?: string;

	@ApiPropertyOptional({ description: 'Model name', type: 'string', example: 'WSDCGQ11LM' })
	@Expose()
	@IsOptional()
	@IsString()
	model?: string;

	@ApiPropertyOptional({ description: 'Device description', type: 'string' })
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
		description: 'Device interview status',
		type: 'string',
		name: 'interview_status',
		example: 'completed',
	})
	@Expose({ name: 'interview_status' })
	@IsString()
	interviewStatus: InterviewStatus;

	@ApiProperty({ description: 'Whether the device is available (online)', type: 'boolean' })
	@Expose()
	@IsBoolean()
	available: boolean;

	@ApiProperty({ description: 'Whether the device is already adopted', type: 'boolean' })
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

	@ApiProperty({ description: 'Device exposes/capabilities', type: () => [ZhExposeInfoModel] })
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ZhExposeInfoModel)
	exposes: ZhExposeInfoModel[];

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

	@ApiPropertyOptional({
		description: 'Link quality indicator (0-255)',
		type: 'number',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsInt()
	lqi?: number;
}

// ============================================================================
// Discovered Device Response Models
// ============================================================================

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginResDiscoveredDevice' })
export class ZigbeeHerdsmanDiscoveredDeviceResponseModel extends BaseSuccessResponseModel<ZigbeeHerdsmanDiscoveredDeviceModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => ZigbeeHerdsmanDiscoveredDeviceModel,
	})
	@Expose()
	declare data: ZigbeeHerdsmanDiscoveredDeviceModel;
}

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginResDiscoveredDevices' })
export class ZigbeeHerdsmanDiscoveredDevicesResponseModel extends BaseSuccessResponseModel<
	ZigbeeHerdsmanDiscoveredDeviceModel[]
> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => [ZigbeeHerdsmanDiscoveredDeviceModel],
	})
	@Expose()
	declare data: ZigbeeHerdsmanDiscoveredDeviceModel[];
}

// ============================================================================
// Property Mapping Preview
// ============================================================================

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginDataPropertyMappingPreview' })
export class ZhPropertyMappingPreviewModel {
	@ApiProperty({ description: 'Property category', enum: PropertyCategory })
	@Expose()
	@IsEnum(PropertyCategory)
	category: PropertyCategory;

	@ApiProperty({ description: 'Property name', type: 'string' })
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({ description: 'Zigbee expose property name', type: 'string', name: 'zigbee_property' })
	@Expose({ name: 'zigbee_property' })
	@IsString()
	zigbeeProperty: string;

	@ApiProperty({ description: 'Data type', enum: DataTypeType, name: 'data_type' })
	@Expose({ name: 'data_type' })
	@IsEnum(DataTypeType)
	dataType: DataTypeType;

	@ApiProperty({ description: 'Permissions', type: [String], enum: PermissionType, isArray: true })
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

	@ApiProperty({ description: 'Whether this property is required', type: 'boolean' })
	@Expose()
	@IsBoolean()
	required: boolean;

	@ApiPropertyOptional({
		description: 'Current value from device state',
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

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginDataSuggestedChannel' })
export class ZhSuggestedChannelModel {
	@ApiProperty({ description: 'Channel category', enum: ChannelCategory })
	@Expose()
	@IsEnum(ChannelCategory)
	category: ChannelCategory;

	@ApiProperty({ description: 'Suggested channel name', type: 'string' })
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({ description: 'Mapping confidence level', enum: ['high', 'medium', 'low'] })
	@Expose()
	@IsString()
	confidence: 'high' | 'medium' | 'low';
}

// ============================================================================
// Expose Mapping Preview
// ============================================================================

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginDataExposeMappingPreview' })
export class ZhExposeMappingPreviewModel {
	@ApiProperty({ description: 'Expose name/property', type: 'string', name: 'expose_name' })
	@Expose({ name: 'expose_name' })
	@IsString()
	exposeName: string;

	@ApiProperty({ description: 'Expose type', type: 'string', name: 'expose_type' })
	@Expose({ name: 'expose_type' })
	@IsString()
	exposeType: string;

	@ApiProperty({ description: 'Mapping status', enum: ['mapped', 'partial', 'unmapped', 'skipped'] })
	@Expose()
	@IsString()
	status: 'mapped' | 'partial' | 'unmapped' | 'skipped';

	@ApiPropertyOptional({
		description: 'Suggested channel mapping',
		type: () => ZhSuggestedChannelModel,
		nullable: true,
		name: 'suggested_channel',
	})
	@Expose({ name: 'suggested_channel' })
	@IsOptional()
	@ValidateNested()
	@Type(() => ZhSuggestedChannelModel)
	suggestedChannel: ZhSuggestedChannelModel | null;

	@ApiProperty({
		description: 'Suggested property mappings',
		type: [ZhPropertyMappingPreviewModel],
		name: 'suggested_properties',
	})
	@Expose({ name: 'suggested_properties' })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ZhPropertyMappingPreviewModel)
	suggestedProperties: ZhPropertyMappingPreviewModel[];

	@ApiProperty({
		description: 'Required properties that are missing',
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

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginDataMappingWarning' })
export class ZhMappingWarningModel {
	@ApiProperty({
		description: 'Warning type',
		enum: [
			'missing_required_channel',
			'missing_required_property',
			'unsupported_expose',
			'unknown_expose_type',
			'device_not_available',
			'device_already_adopted',
			'interview_incomplete',
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
		| 'device_already_adopted'
		| 'interview_incomplete';

	@ApiPropertyOptional({ description: 'Related expose name', type: 'string', nullable: true, name: 'expose_name' })
	@Expose({ name: 'expose_name' })
	@IsOptional()
	@IsString()
	exposeName?: string;

	@ApiProperty({ description: 'Warning message', type: 'string' })
	@Expose()
	@IsString()
	message: string;

	@ApiPropertyOptional({ description: 'Suggested resolution', type: 'string', nullable: true })
	@Expose()
	@IsOptional()
	@IsString()
	suggestion?: string;
}

// ============================================================================
// Suggested Device
// ============================================================================

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginDataSuggestedDevice' })
export class ZhSuggestedDeviceModel {
	@ApiProperty({ description: 'Device category', enum: DeviceCategory })
	@Expose()
	@IsEnum(DeviceCategory)
	category: DeviceCategory;

	@ApiProperty({ description: 'Suggested device name', type: 'string' })
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({ description: 'Mapping confidence level', enum: ['high', 'medium', 'low'] })
	@Expose()
	@IsString()
	confidence: 'high' | 'medium' | 'low';
}

// ============================================================================
// Device Info
// ============================================================================

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginDataDeviceInfo' })
export class ZhDeviceInfoModel {
	@ApiProperty({ description: 'IEEE address', type: 'string', name: 'ieee_address' })
	@Expose({ name: 'ieee_address' })
	@IsString()
	ieeeAddress: string;

	@ApiProperty({ description: 'Friendly name', type: 'string', name: 'friendly_name' })
	@Expose({ name: 'friendly_name' })
	@IsString()
	friendlyName: string;

	@ApiPropertyOptional({ description: 'Manufacturer', type: 'string', nullable: true })
	@Expose()
	@IsOptional()
	@IsString()
	manufacturer: string | null;

	@ApiPropertyOptional({ description: 'Model', type: 'string', nullable: true })
	@Expose()
	@IsOptional()
	@IsString()
	model: string | null;

	@ApiPropertyOptional({ description: 'Description', type: 'string', nullable: true })
	@Expose()
	@IsOptional()
	@IsString()
	description: string | null;
}

// ============================================================================
// Mapping Preview
// ============================================================================

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginDataMappingPreview' })
export class ZhMappingPreviewModel {
	@ApiProperty({
		description: 'Device information',
		type: () => ZhDeviceInfoModel,
		name: 'zh_device',
	})
	@Expose({ name: 'zh_device' })
	@ValidateNested()
	@Type(() => ZhDeviceInfoModel)
	zhDevice: ZhDeviceInfoModel;

	@ApiProperty({
		description: 'Suggested Smart Panel device',
		type: () => ZhSuggestedDeviceModel,
		name: 'suggested_device',
	})
	@Expose({ name: 'suggested_device' })
	@ValidateNested()
	@Type(() => ZhSuggestedDeviceModel)
	suggestedDevice: ZhSuggestedDeviceModel;

	@ApiProperty({ description: 'Expose mapping previews', type: [ZhExposeMappingPreviewModel] })
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ZhExposeMappingPreviewModel)
	exposes: ZhExposeMappingPreviewModel[];

	@ApiProperty({ description: 'Mapping warnings', type: [ZhMappingWarningModel] })
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ZhMappingWarningModel)
	warnings: ZhMappingWarningModel[];

	@ApiProperty({
		description: 'Whether the mapping is ready for adoption',
		type: 'boolean',
		name: 'ready_to_adopt',
	})
	@Expose({ name: 'ready_to_adopt' })
	@IsBoolean()
	readyToAdopt: boolean;
}

// ============================================================================
// Mapping Preview Response
// ============================================================================

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginResMappingPreview' })
export class ZhMappingPreviewResponseModel extends BaseSuccessResponseModel<ZhMappingPreviewModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => ZhMappingPreviewModel,
	})
	@Expose()
	declare data: ZhMappingPreviewModel;
}

// ============================================================================
// Coordinator Info Response
// ============================================================================

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginDataCoordinatorInfo' })
export class ZhCoordinatorInfoModel {
	@ApiProperty({ description: 'Adapter type', type: 'string' })
	@Expose()
	@IsString()
	type: string;

	@ApiProperty({ description: 'Coordinator IEEE address', type: 'string', name: 'ieee_address' })
	@Expose({ name: 'ieee_address' })
	@IsString()
	ieeeAddress: string;

	@ApiPropertyOptional({ description: 'Firmware version', type: 'string', nullable: true, name: 'firmware_version' })
	@Expose({ name: 'firmware_version' })
	@IsOptional()
	@IsString()
	firmwareVersion: string | null;

	@ApiProperty({ description: 'Zigbee channel', type: 'number' })
	@Expose()
	@IsInt()
	channel: number;

	@ApiProperty({ description: 'PAN ID', type: 'number', name: 'pan_id' })
	@Expose({ name: 'pan_id' })
	@IsInt()
	panId: number;

	@ApiProperty({ description: 'Number of paired devices', type: 'number', name: 'paired_device_count' })
	@Expose({ name: 'paired_device_count' })
	@IsInt()
	pairedDeviceCount: number;

	@ApiProperty({ description: 'Permit join state', type: 'boolean', name: 'permit_join' })
	@Expose({ name: 'permit_join' })
	@IsBoolean()
	permitJoin: boolean;
}

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginResCoordinatorInfo' })
export class ZhCoordinatorInfoResponseModel extends BaseSuccessResponseModel<ZhCoordinatorInfoModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => ZhCoordinatorInfoModel,
	})
	@Expose()
	declare data: ZhCoordinatorInfoModel;
}

// ============================================================================
// Permit Join Response
// ============================================================================

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginDataPermitJoin' })
export class ZhPermitJoinModel {
	@ApiProperty({ description: 'Whether permit join is enabled', type: 'boolean' })
	@Expose()
	@IsBoolean()
	enabled: boolean;

	@ApiProperty({ description: 'Timeout in seconds', type: 'number' })
	@Expose()
	@IsInt()
	timeout: number;
}

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginResPermitJoin' })
export class ZhPermitJoinResponseModel extends BaseSuccessResponseModel<ZhPermitJoinModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => ZhPermitJoinModel,
	})
	@Expose()
	declare data: ZhPermitJoinModel;
}
