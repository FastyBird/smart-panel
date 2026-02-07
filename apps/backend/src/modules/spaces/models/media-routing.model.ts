import { Expose, Type } from 'class-transformer';

import { ApiExtraModels, ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { MediaCapabilityPermission, MediaEndpointType } from '../spaces.constants';

// ========================
// Capability Models
// ========================

/**
 * Individual capability mapping for an endpoint
 */
@ApiSchema({ name: 'SpacesModuleDataMediaCapabilityMapping' })
export class MediaCapabilityMappingModel {
	@ApiProperty({
		name: 'property_id',
		description: 'ID of the property that provides this capability',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'property_id' })
	propertyId: string;

	@ApiProperty({
		description: 'Permission level for this capability',
		enum: MediaCapabilityPermission,
	})
	@Expose()
	permission: MediaCapabilityPermission;

	@ApiPropertyOptional({
		name: 'channel_id',
		description: 'ID of the channel containing this property',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'channel_id' })
	channelId?: string;

	@ApiPropertyOptional({
		name: 'data_type',
		description: 'Data type of the property (e.g. enum, string)',
		type: 'string',
	})
	@Expose({ name: 'data_type' })
	dataType?: string;

	@ApiPropertyOptional({
		description: 'Format constraints (e.g. enum values)',
		type: 'array',
		items: { oneOf: [{ type: 'string' }, { type: 'number' }] },
	})
	@Expose()
	format?: string[] | number[] | null;
}

/**
 * Complete capability summary for a device
 */
@ApiSchema({ name: 'SpacesModuleDataMediaCapabilitySummary' })
export class MediaCapabilitySummaryModel {
	@ApiProperty({
		name: 'device_id',
		description: 'ID of the device',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'device_id' })
	deviceId: string;

	@ApiProperty({
		name: 'device_name',
		description: 'Name of the device',
		type: 'string',
	})
	@Expose({ name: 'device_name' })
	deviceName: string;

	@ApiProperty({
		name: 'device_category',
		description: 'Category of the device',
		type: 'string',
	})
	@Expose({ name: 'device_category' })
	deviceCategory: string;

	@ApiProperty({
		name: 'is_online',
		description: 'Whether the device is currently online',
		type: 'boolean',
	})
	@Expose({ name: 'is_online' })
	isOnline: boolean;

	@ApiPropertyOptional({
		description: 'Power capability mapping',
		type: () => MediaCapabilityMappingModel,
	})
	@Expose()
	@Type(() => MediaCapabilityMappingModel)
	power?: MediaCapabilityMappingModel;

	@ApiPropertyOptional({
		description: 'Volume capability mapping',
		type: () => MediaCapabilityMappingModel,
	})
	@Expose()
	@Type(() => MediaCapabilityMappingModel)
	volume?: MediaCapabilityMappingModel;

	@ApiPropertyOptional({
		description: 'Mute capability mapping',
		type: () => MediaCapabilityMappingModel,
	})
	@Expose()
	@Type(() => MediaCapabilityMappingModel)
	mute?: MediaCapabilityMappingModel;

	@ApiPropertyOptional({
		description: 'Playback control capability mapping',
		type: () => MediaCapabilityMappingModel,
	})
	@Expose()
	@Type(() => MediaCapabilityMappingModel)
	playback?: MediaCapabilityMappingModel;

	@ApiPropertyOptional({
		name: 'playback_state',
		description: 'Playback state capability mapping',
		type: () => MediaCapabilityMappingModel,
	})
	@Expose({ name: 'playback_state' })
	@Type(() => MediaCapabilityMappingModel)
	playbackState?: MediaCapabilityMappingModel;

	@ApiPropertyOptional({
		description: 'Input/source selection capability mapping',
		type: () => MediaCapabilityMappingModel,
	})
	@Expose()
	@Type(() => MediaCapabilityMappingModel)
	input?: MediaCapabilityMappingModel;

	@ApiPropertyOptional({
		description: 'Remote control capability mapping',
		type: () => MediaCapabilityMappingModel,
	})
	@Expose()
	@Type(() => MediaCapabilityMappingModel)
	remote?: MediaCapabilityMappingModel;

	@ApiPropertyOptional({
		name: 'track_metadata',
		description: 'Track name capability mapping',
		type: () => MediaCapabilityMappingModel,
	})
	@Expose({ name: 'track_metadata' })
	@Type(() => MediaCapabilityMappingModel)
	trackMetadata?: MediaCapabilityMappingModel;

	@ApiPropertyOptional({
		description: 'Album name capability mapping',
		type: () => MediaCapabilityMappingModel,
	})
	@Expose()
	@Type(() => MediaCapabilityMappingModel)
	album?: MediaCapabilityMappingModel;

	@ApiPropertyOptional({
		description: 'Artist name capability mapping',
		type: () => MediaCapabilityMappingModel,
	})
	@Expose()
	@Type(() => MediaCapabilityMappingModel)
	artist?: MediaCapabilityMappingModel;

	@ApiPropertyOptional({
		description: 'Playback position capability mapping',
		type: () => MediaCapabilityMappingModel,
	})
	@Expose()
	@Type(() => MediaCapabilityMappingModel)
	position?: MediaCapabilityMappingModel;

	@ApiPropertyOptional({
		description: 'Track duration capability mapping',
		type: () => MediaCapabilityMappingModel,
	})
	@Expose()
	@Type(() => MediaCapabilityMappingModel)
	duration?: MediaCapabilityMappingModel;

	@ApiProperty({
		name: 'suggested_endpoint_types',
		description: 'Suggested endpoint types based on device capabilities',
		type: 'array',
		items: { type: 'string', enum: Object.values(MediaEndpointType) },
	})
	@Expose({ name: 'suggested_endpoint_types' })
	suggestedEndpointTypes: MediaEndpointType[];
}

// ========================
// Execution Plan Models
// ========================

// ========================
// Response Models
// ========================

/**
 * Response wrapper for capability summaries
 */
@ApiSchema({ name: 'SpacesModuleResMediaCapabilities' })
@ApiExtraModels(MediaCapabilitySummaryModel)
export class MediaCapabilitiesResponseModel extends BaseSuccessResponseModel<MediaCapabilitySummaryModel[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(MediaCapabilitySummaryModel) },
	})
	@Expose()
	@Type(() => MediaCapabilitySummaryModel)
	declare data: MediaCapabilitySummaryModel[];
}
