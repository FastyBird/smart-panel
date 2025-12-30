import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';

@ApiSchema({ name: 'DevicesHomeAssistantPluginDataHelperPropertyMappingPreview' })
export class HelperPropertyMappingPreviewModel {
	@ApiProperty({
		description: 'Smart Panel property category',
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
		description: 'Home Assistant attribute this maps to',
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
		description: 'Property permissions',
		type: [String],
		enum: PermissionType,
	})
	@Expose()
	@IsArray()
	permissions: PermissionType[];

	@ApiPropertyOptional({
		description: 'Unit of measurement',
		type: 'string',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	unit: string | null;

	@ApiPropertyOptional({
		description: 'Format (enum values or range)',
		type: 'array',
		items: { oneOf: [{ type: 'string' }, { type: 'number' }] },
		nullable: true,
	})
	@Expose()
	@IsOptional()
	format: (string | number)[] | null;

	@ApiProperty({
		description: 'Whether this property is required',
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
	@IsOptional()
	currentValue: string | number | boolean | null;
}

@ApiSchema({ name: 'DevicesHomeAssistantPluginDataHelperChannelMappingPreview' })
export class HelperChannelMappingPreviewModel {
	@ApiProperty({
		description: 'Smart Panel channel category',
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
		description: 'Mapping confidence',
		enum: ['high', 'medium', 'low'],
	})
	@Expose()
	confidence: 'high' | 'medium' | 'low';

	@ApiProperty({
		description: 'Suggested properties for this channel',
		type: 'array',
		items: { $ref: getSchemaPath(HelperPropertyMappingPreviewModel) },
		name: 'suggested_properties',
	})
	@Expose({ name: 'suggested_properties' })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => HelperPropertyMappingPreviewModel)
	suggestedProperties: HelperPropertyMappingPreviewModel[];
}

@ApiSchema({ name: 'DevicesHomeAssistantPluginDataHelperInfo' })
export class HelperInfoModel {
	@ApiProperty({
		description: 'Helper entity ID',
		type: 'string',
		name: 'entity_id',
	})
	@Expose({ name: 'entity_id' })
	@IsString()
	entityId: string;

	@ApiProperty({
		description: 'Helper friendly name',
		type: 'string',
	})
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({
		description: 'Home Assistant domain',
		type: 'string',
	})
	@Expose()
	@IsString()
	domain: string;
}

@ApiSchema({ name: 'DevicesHomeAssistantPluginDataSuggestedHelperDevice' })
export class SuggestedHelperDeviceModel {
	@ApiProperty({
		description: 'Suggested device category',
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
		description: 'Confidence in the suggestion',
		enum: ['high', 'medium', 'low'],
	})
	@Expose()
	confidence: 'high' | 'medium' | 'low';
}

@ApiSchema({ name: 'DevicesHomeAssistantPluginDataHelperMappingWarning' })
export class HelperMappingWarningModel {
	@ApiProperty({
		description: 'Warning type',
		type: 'string',
	})
	@Expose()
	@IsString()
	type: string;

	@ApiProperty({
		description: 'Warning message',
		type: 'string',
	})
	@Expose()
	@IsString()
	message: string;

	@ApiPropertyOptional({
		description: 'Suggested action',
		type: 'string',
	})
	@Expose()
	@IsOptional()
	@IsString()
	suggestion?: string;
}

@ApiSchema({ name: 'DevicesHomeAssistantPluginDataHelperMappingPreview' })
export class HelperMappingPreviewModel {
	@ApiProperty({
		description: 'Helper information',
		type: () => HelperInfoModel,
		name: 'helper',
	})
	@Expose({ name: 'helper' })
	@ValidateNested()
	@Type(() => HelperInfoModel)
	helper: HelperInfoModel;

	@ApiProperty({
		description: 'Suggested device configuration',
		type: () => SuggestedHelperDeviceModel,
		name: 'suggested_device',
	})
	@Expose({ name: 'suggested_device' })
	@ValidateNested()
	@Type(() => SuggestedHelperDeviceModel)
	suggestedDevice: SuggestedHelperDeviceModel;

	@ApiProperty({
		description: 'Suggested channel configuration (first/primary channel for backward compatibility)',
		type: () => HelperChannelMappingPreviewModel,
		name: 'suggested_channel',
	})
	@Expose({ name: 'suggested_channel' })
	@ValidateNested()
	@Type(() => HelperChannelMappingPreviewModel)
	suggestedChannel: HelperChannelMappingPreviewModel;

	@ApiProperty({
		description: 'All suggested channels for this helper',
		type: 'array',
		items: { $ref: getSchemaPath(HelperChannelMappingPreviewModel) },
		name: 'suggested_channels',
	})
	@Expose({ name: 'suggested_channels' })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => HelperChannelMappingPreviewModel)
	suggestedChannels: HelperChannelMappingPreviewModel[];

	@ApiProperty({
		description: 'Mapping warnings',
		type: 'array',
		items: { $ref: getSchemaPath(HelperMappingWarningModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => HelperMappingWarningModel)
	warnings: HelperMappingWarningModel[];

	@ApiProperty({
		description: 'Whether the helper is ready to be adopted',
		type: 'boolean',
		name: 'ready_to_adopt',
	})
	@Expose({ name: 'ready_to_adopt' })
	@IsBoolean()
	readyToAdopt: boolean;
}

/**
 * Response wrapper for HelperMappingPreviewModel
 */
@ApiSchema({ name: 'DevicesHomeAssistantPluginResHelperMappingPreview' })
export class HelperMappingPreviewResponseModel extends BaseSuccessResponseModel<HelperMappingPreviewModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => HelperMappingPreviewModel,
	})
	@Expose()
	declare data: HelperMappingPreviewModel;
}
