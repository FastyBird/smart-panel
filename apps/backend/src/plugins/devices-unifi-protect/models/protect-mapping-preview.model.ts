import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import {
	PROTECT_RTSPS_QUALITIES,
	PROTECT_STREAM_QUALITIES,
	ProtectRtspsQuality,
	ProtectStreamQuality,
} from '../devices-unifi-protect.constants';
import { PROTECT_MODEL_KEYS, ProtectMappingScalar, ProtectModelKey } from '../mappings/mapping.types';

export enum ProtectPreviewWarningCode {
	STREAM_NOT_ENABLED = 'stream_not_enabled',
	HEVC_CODEC = 'hevc_codec',
	THIRD_PARTY_CAMERA = 'third_party_camera',
	DEVICE_DISCONNECTED = 'device_disconnected',
	UNSUPPORTED_DETECTION_TYPE = 'unsupported_detection_type',
	STREAM_STATE_UNKNOWN = 'stream_state_unknown',
	SPEC_VALIDATION_FAILED = 'spec_validation_failed',
}

export enum ProtectPreviewWarningSeverity {
	INFO = 'info',
	WARNING = 'warning',
	ERROR = 'error',
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginDataMappingPreviewDevice' })
export class ProtectMappingPreviewDeviceModel {
	@ApiProperty({ description: 'UniFi Protect device identifier' })
	@Expose()
	@IsString()
	id: string;

	@ApiProperty({ name: 'model_key', description: 'UniFi Protect device kind', enum: PROTECT_MODEL_KEYS })
	@Expose({ name: 'model_key' })
	@IsString()
	modelKey: ProtectModelKey;

	@ApiProperty({ description: 'Device name that adoption would create' })
	@Expose()
	@IsString()
	name: string;

	@ApiPropertyOptional({ description: 'Hardware model reported by the console', nullable: true, type: 'string' })
	@Expose()
	@IsOptional()
	@IsString()
	model: string | null;

	@ApiProperty({ description: 'Device state reported by the console, for example CONNECTED' })
	@Expose()
	@IsString()
	state: string;
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginDataMappingPreviewProperty' })
export class ProtectMappingPreviewPropertyModel {
	@ApiProperty({ description: 'Property identifier' })
	@Expose()
	@IsString()
	identifier: string;

	@ApiProperty({ description: 'Property category', enum: PropertyCategory })
	@Expose()
	@IsEnum(PropertyCategory)
	category: PropertyCategory;

	@ApiProperty({ description: 'Property name' })
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({ name: 'data_type', description: 'Property data type', enum: DataTypeType })
	@Expose({ name: 'data_type' })
	@IsEnum(DataTypeType)
	dataType: DataTypeType;

	@ApiProperty({ description: 'Property permissions', enum: PermissionType, isArray: true })
	@Expose()
	@IsArray()
	permissions: PermissionType[];

	@ApiPropertyOptional({ description: 'Property unit from the spec', nullable: true, type: 'string' })
	@Expose()
	@IsOptional()
	@IsString()
	unit: string | null;

	@ApiPropertyOptional({
		description: 'Allowed values or range',
		nullable: true,
		type: 'array',
		items: { oneOf: [{ type: 'string' }, { type: 'number' }] },
	})
	@Expose()
	@IsOptional()
	@IsArray()
	format: (string | number)[] | null;

	@ApiPropertyOptional({ description: 'Value step', nullable: true, type: 'number' })
	@Expose()
	@IsOptional()
	step: number | null;

	@ApiPropertyOptional({
		description: 'Initial value derived from the console, when it has one',
		nullable: true,
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
	})
	@Expose()
	@IsOptional()
	value: ProtectMappingScalar;

	@ApiProperty({ name: 'mapping_name', description: 'Name of the property mapping' })
	@Expose({ name: 'mapping_name' })
	@IsString()
	mappingName: string;
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginDataMappingPreviewChannel' })
export class ProtectMappingPreviewChannelModel {
	@ApiProperty({ description: 'Channel identifier' })
	@Expose()
	@IsString()
	identifier: string;

	@ApiProperty({ description: 'Channel category', enum: ChannelCategory })
	@Expose()
	@IsEnum(ChannelCategory)
	category: ChannelCategory;

	@ApiProperty({ description: 'Channel name' })
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({ name: 'mapping_name', description: 'Name of the channel mapping' })
	@Expose({ name: 'mapping_name' })
	@IsString()
	mappingName: string;

	@ApiProperty({ type: () => [ProtectMappingPreviewPropertyModel] })
	@Expose()
	@Type(() => ProtectMappingPreviewPropertyModel)
	@IsArray()
	properties: ProtectMappingPreviewPropertyModel[];
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginDataMappingPreviewWarning' })
export class ProtectMappingPreviewWarningModel {
	@ApiProperty({ description: 'Warning code', enum: ProtectPreviewWarningCode })
	@Expose()
	@IsEnum(ProtectPreviewWarningCode)
	code: ProtectPreviewWarningCode;

	@ApiProperty({ description: 'Warning severity', enum: ProtectPreviewWarningSeverity })
	@Expose()
	@IsEnum(ProtectPreviewWarningSeverity)
	severity: ProtectPreviewWarningSeverity;

	@ApiPropertyOptional({
		description: 'Channel or value the warning refers to',
		nullable: true,
		type: 'string',
	})
	@Expose()
	@IsOptional()
	@IsString()
	identifier: string | null;
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginDataMappingPreviewStream' })
export class ProtectMappingPreviewStreamModel {
	@ApiPropertyOptional({
		name: 'enabled_qualities',
		description: 'Stream qualities already enabled on the console; null when the console could not be read',
		enum: PROTECT_RTSPS_QUALITIES,
		isArray: true,
		nullable: true,
	})
	@Expose({ name: 'enabled_qualities' })
	@IsOptional()
	@IsArray()
	enabledQualities: ProtectRtspsQuality[] | null;

	@ApiProperty({
		name: 'default_quality',
		description: 'Stream quality adoption would enable',
		enum: PROTECT_STREAM_QUALITIES,
	})
	@Expose({ name: 'default_quality' })
	@IsString()
	defaultQuality: ProtectStreamQuality;

	@ApiProperty({ name: 'package_camera', description: 'Whether the device has a package camera' })
	@Expose({ name: 'package_camera' })
	@IsBoolean()
	packageCamera: boolean;
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginDataMappingPreview' })
export class ProtectMappingPreviewModel {
	@ApiProperty({ type: () => ProtectMappingPreviewDeviceModel })
	@Expose()
	@Type(() => ProtectMappingPreviewDeviceModel)
	device: ProtectMappingPreviewDeviceModel;

	@ApiProperty({ description: 'Smart Panel device identifier, <console MAC>:<Protect device id>' })
	@Expose()
	@IsString()
	identifier: string;

	@ApiProperty({ description: 'Smart Panel device category', enum: DeviceCategory })
	@Expose()
	@IsEnum(DeviceCategory)
	category: DeviceCategory;

	@ApiProperty({ name: 'mapping_name', description: 'Name of the device mapping' })
	@Expose({ name: 'mapping_name' })
	@IsString()
	mappingName: string;

	@ApiProperty({ type: () => [ProtectMappingPreviewChannelModel] })
	@Expose()
	@Type(() => ProtectMappingPreviewChannelModel)
	@IsArray()
	channels: ProtectMappingPreviewChannelModel[];

	@ApiProperty({ type: () => [ProtectMappingPreviewWarningModel] })
	@Expose()
	@Type(() => ProtectMappingPreviewWarningModel)
	@IsArray()
	warnings: ProtectMappingPreviewWarningModel[];

	@ApiPropertyOptional({
		description: 'Stream state for cameras and doorbells; null for sensors and floodlights',
		type: () => ProtectMappingPreviewStreamModel,
		nullable: true,
	})
	@Expose()
	@Type(() => ProtectMappingPreviewStreamModel)
	@IsOptional()
	stream: ProtectMappingPreviewStreamModel | null;

	@ApiProperty({ name: 'ready_to_adopt', description: 'False when the mapped structure fails spec validation' })
	@Expose({ name: 'ready_to_adopt' })
	@IsBoolean()
	readyToAdopt: boolean;

	@ApiProperty({ description: 'Whether a device with this identifier already exists in Smart Panel' })
	@Expose()
	@IsBoolean()
	adopted: boolean;

	@ApiPropertyOptional({
		name: 'adopted_device_id',
		description: 'Smart Panel device identifier when adopted',
		type: 'string',
		format: 'uuid',
		nullable: true,
	})
	@Expose({ name: 'adopted_device_id' })
	@IsOptional()
	@IsString()
	adoptedDeviceId: string | null;
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginResMappingPreview' })
export class ProtectMappingPreviewResponseModel extends BaseSuccessResponseModel<ProtectMappingPreviewModel> {
	@ApiProperty({ type: () => ProtectMappingPreviewModel })
	@Expose()
	@Type(() => ProtectMappingPreviewModel)
	declare data: ProtectMappingPreviewModel;
}
