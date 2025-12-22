import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../devices.constants';

/**
 * Severity level for validation issues
 */
export enum ValidationIssueSeverity {
	ERROR = 'error',
	WARNING = 'warning',
}

/**
 * Type of validation issue
 */
export enum ValidationIssueType {
	MISSING_CHANNEL = 'missing_channel',
	MISSING_PROPERTY = 'missing_property',
	INVALID_DATA_TYPE = 'invalid_data_type',
	INVALID_PERMISSIONS = 'invalid_permissions',
	INVALID_FORMAT = 'invalid_format',
	UNKNOWN_CHANNEL = 'unknown_channel',
	DUPLICATE_CHANNEL = 'duplicate_channel',
}

/**
 * A single validation issue
 */
@ApiSchema({ name: 'DevicesModuleDataValidationIssue' })
export class ValidationIssueModel {
	@ApiProperty({
		description: 'Type of validation issue',
		enum: ValidationIssueType,
		example: ValidationIssueType.MISSING_CHANNEL,
	})
	@Expose()
	@IsEnum(ValidationIssueType)
	type: ValidationIssueType;

	@ApiProperty({
		description: 'Severity of the issue',
		enum: ValidationIssueSeverity,
		example: ValidationIssueSeverity.ERROR,
	})
	@Expose()
	@IsEnum(ValidationIssueSeverity)
	severity: ValidationIssueSeverity;

	@ApiPropertyOptional({
		description: 'Channel category related to the issue',
		name: 'channel_category',
		enum: ChannelCategory,
		nullable: true,
	})
	@Expose({ name: 'channel_category' })
	@IsOptional()
	@IsEnum(ChannelCategory)
	channelCategory?: ChannelCategory;

	@ApiPropertyOptional({
		description: 'Channel ID related to the issue',
		name: 'channel_id',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'channel_id' })
	@IsOptional()
	@IsString()
	channelId?: string;

	@ApiPropertyOptional({
		description: 'Property category related to the issue',
		name: 'property_category',
		enum: PropertyCategory,
		nullable: true,
	})
	@Expose({ name: 'property_category' })
	@IsOptional()
	@IsEnum(PropertyCategory)
	propertyCategory?: PropertyCategory;

	@ApiPropertyOptional({
		description: 'Property ID related to the issue',
		name: 'property_id',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'property_id' })
	@IsOptional()
	@IsString()
	propertyId?: string;

	@ApiProperty({
		description: 'Human-readable description of the issue',
		type: 'string',
		example: 'Missing required channel: device_information',
	})
	@Expose()
	@IsString()
	message: string;

	@ApiPropertyOptional({
		description: 'Expected value or state',
		type: 'string',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	expected?: string;

	@ApiPropertyOptional({
		description: 'Actual value or state found',
		type: 'string',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	actual?: string;
}

/**
 * Validation result for a single device
 */
@ApiSchema({ name: 'DevicesModuleDataDeviceValidationResult' })
export class DeviceValidationResultModel {
	@ApiProperty({
		description: 'Device ID',
		name: 'device_id',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'device_id' })
	@IsString()
	deviceId: string;

	@ApiPropertyOptional({
		description: 'Device identifier',
		name: 'device_identifier',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'device_identifier' })
	@IsOptional()
	@IsString()
	deviceIdentifier: string | null;

	@ApiProperty({
		description: 'Device name',
		name: 'device_name',
		type: 'string',
	})
	@Expose({ name: 'device_name' })
	@IsString()
	deviceName: string;

	@ApiProperty({
		description: 'Device category',
		name: 'device_category',
		enum: DeviceCategory,
	})
	@Expose({ name: 'device_category' })
	@IsEnum(DeviceCategory)
	deviceCategory: DeviceCategory;

	@ApiProperty({
		description: 'Plugin type that registered this device',
		name: 'plugin_type',
		type: 'string',
	})
	@Expose({ name: 'plugin_type' })
	@IsString()
	pluginType: string;

	@ApiProperty({
		description: 'Whether the device passes validation (no errors)',
		name: 'is_valid',
		type: 'boolean',
	})
	@Expose({ name: 'is_valid' })
	@IsBoolean()
	isValid: boolean;

	@ApiProperty({
		description: 'List of validation issues',
		type: 'array',
		items: { $ref: getSchemaPath(ValidationIssueModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ValidationIssueModel)
	issues: ValidationIssueModel[];
}

/**
 * Summary of validation results
 */
@ApiSchema({ name: 'DevicesModuleDataValidationSummary' })
export class ValidationSummaryModel {
	@ApiProperty({
		description: 'Total number of devices validated',
		name: 'total_devices',
		type: 'number',
	})
	@Expose({ name: 'total_devices' })
	@IsNumber()
	totalDevices: number;

	@ApiProperty({
		description: 'Number of devices that passed validation',
		name: 'valid_devices',
		type: 'number',
	})
	@Expose({ name: 'valid_devices' })
	@IsNumber()
	validDevices: number;

	@ApiProperty({
		description: 'Number of devices that failed validation',
		name: 'invalid_devices',
		type: 'number',
	})
	@Expose({ name: 'invalid_devices' })
	@IsNumber()
	invalidDevices: number;

	@ApiProperty({
		description: 'Total number of validation issues',
		name: 'total_issues',
		type: 'number',
	})
	@Expose({ name: 'total_issues' })
	@IsNumber()
	totalIssues: number;

	@ApiProperty({
		description: 'Number of error-level issues',
		name: 'error_count',
		type: 'number',
	})
	@Expose({ name: 'error_count' })
	@IsNumber()
	errorCount: number;

	@ApiProperty({
		description: 'Number of warning-level issues',
		name: 'warning_count',
		type: 'number',
	})
	@Expose({ name: 'warning_count' })
	@IsNumber()
	warningCount: number;
}

/**
 * Full validation response data
 */
@ApiSchema({ name: 'DevicesModuleDataDevicesValidation' })
export class DevicesValidationModel {
	@ApiProperty({
		description: 'Summary of validation results',
		type: () => ValidationSummaryModel,
	})
	@Expose()
	@ValidateNested()
	@Type(() => ValidationSummaryModel)
	summary: ValidationSummaryModel;

	@ApiProperty({
		description: 'Validation results for each device',
		type: 'array',
		items: { $ref: getSchemaPath(DeviceValidationResultModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => DeviceValidationResultModel)
	devices: DeviceValidationResultModel[];
}

/**
 * Response wrapper for device validation results
 */
@ApiSchema({ name: 'DevicesModuleResDevicesValidation' })
export class DevicesValidationResponseModel extends BaseSuccessResponseModel<DevicesValidationModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => DevicesValidationModel,
	})
	@Expose()
	declare data: DevicesValidationModel;
}

/**
 * Response wrapper for single device validation result
 */
@ApiSchema({ name: 'DevicesModuleResDeviceValidation' })
export class DeviceValidationResponseModel extends BaseSuccessResponseModel<DeviceValidationResultModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => DeviceValidationResultModel,
	})
	@Expose()
	declare data: DeviceValidationResultModel;
}
