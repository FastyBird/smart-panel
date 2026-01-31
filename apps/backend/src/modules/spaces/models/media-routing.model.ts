import { Expose, Type } from 'class-transformer';

import { ApiExtraModels, ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import {
	MediaActivationState,
	MediaCapabilityPermission,
	MediaEndpointType,
	MediaRoutingType,
} from '../spaces.constants';

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
		description: 'Track metadata capability mapping',
		type: () => MediaCapabilityMappingModel,
	})
	@Expose({ name: 'track_metadata' })
	@Type(() => MediaCapabilityMappingModel)
	trackMetadata?: MediaCapabilityMappingModel;

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

/**
 * Individual step in an execution plan
 */
@ApiSchema({ name: 'SpacesModuleDataMediaExecutionStep' })
export class MediaExecutionStepModel {
	@ApiProperty({
		description: 'Order of execution (lower = earlier)',
		type: 'integer',
	})
	@Expose()
	order: number;

	@ApiProperty({
		name: 'endpoint_id',
		description: 'ID of the endpoint being controlled',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'endpoint_id' })
	endpointId: string;

	@ApiProperty({
		name: 'device_id',
		description: 'ID of the device being controlled',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'device_id' })
	deviceId: string;

	@ApiProperty({
		name: 'channel_id',
		description: 'ID of the channel being controlled',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'channel_id' })
	channelId: string;

	@ApiProperty({
		name: 'property_id',
		description: 'ID of the property being set',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'property_id' })
	propertyId: string;

	@ApiProperty({
		description: 'Type of action to perform',
		enum: ['set_property', 'send_command'],
	})
	@Expose()
	action: 'set_property' | 'send_command';

	@ApiProperty({
		description: 'Value to set or command to send',
	})
	@Expose()
	value: unknown;

	@ApiProperty({
		description: 'Whether this step is critical (failure aborts plan)',
		type: 'boolean',
	})
	@Expose()
	critical: boolean;

	@ApiPropertyOptional({
		description: 'Human-readable description of this step',
		type: 'string',
	})
	@Expose()
	description?: string;
}

/**
 * Complete execution plan for routing activation
 */
@ApiSchema({ name: 'SpacesModuleDataMediaExecutionPlan' })
export class MediaExecutionPlanModel {
	@ApiProperty({
		name: 'routing_id',
		description: 'ID of the routing being activated',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'routing_id' })
	routingId: string;

	@ApiProperty({
		name: 'space_id',
		description: 'ID of the space',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'space_id' })
	spaceId: string;

	@ApiProperty({
		name: 'routing_type',
		description: 'Type of the routing being activated',
		enum: MediaRoutingType,
	})
	@Expose({ name: 'routing_type' })
	routingType: MediaRoutingType;

	@ApiProperty({
		description: 'Ordered list of execution steps',
		type: 'array',
		items: { $ref: getSchemaPath(MediaExecutionStepModel) },
	})
	@Expose()
	@Type(() => MediaExecutionStepModel)
	steps: MediaExecutionStepModel[];

	@ApiProperty({
		name: 'total_steps',
		description: 'Total number of steps in the plan',
		type: 'integer',
	})
	@Expose({ name: 'total_steps' })
	totalSteps: number;

	@ApiProperty({
		name: 'critical_steps',
		description: 'Number of critical steps',
		type: 'integer',
	})
	@Expose({ name: 'critical_steps' })
	criticalSteps: number;
}

// ========================
// Execution Result Models
// ========================

/**
 * Result of a single execution step
 */
@ApiSchema({ name: 'SpacesModuleDataMediaExecutionStepResult' })
export class MediaExecutionStepResultModel {
	@ApiProperty({
		description: 'Order of the step',
		type: 'integer',
	})
	@Expose()
	order: number;

	@ApiProperty({
		name: 'device_id',
		description: 'ID of the device',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'device_id' })
	deviceId: string;

	@ApiProperty({
		description: 'Status of the step execution',
		enum: ['success', 'failed', 'skipped'],
	})
	@Expose()
	status: 'success' | 'failed' | 'skipped';

	@ApiPropertyOptional({
		description: 'Error message if failed',
		type: 'string',
	})
	@Expose()
	error?: string;
}

/**
 * Complete result of routing activation
 */
@ApiSchema({ name: 'SpacesModuleDataMediaRoutingActivationResult' })
@ApiExtraModels(MediaExecutionStepResultModel)
export class MediaRoutingActivationResultModel {
	@ApiProperty({
		description: 'Whether the activation was successful overall',
		type: 'boolean',
	})
	@Expose()
	success: boolean;

	@ApiProperty({
		name: 'routing_id',
		description: 'ID of the activated routing',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'routing_id' })
	routingId: string;

	@ApiProperty({
		name: 'routing_type',
		description: 'Type of the activated routing',
		enum: MediaRoutingType,
	})
	@Expose({ name: 'routing_type' })
	routingType: MediaRoutingType;

	@ApiProperty({
		name: 'steps_executed',
		description: 'Number of steps successfully executed',
		type: 'integer',
	})
	@Expose({ name: 'steps_executed' })
	stepsExecuted: number;

	@ApiProperty({
		name: 'steps_failed',
		description: 'Number of steps that failed',
		type: 'integer',
	})
	@Expose({ name: 'steps_failed' })
	stepsFailed: number;

	@ApiProperty({
		name: 'steps_skipped',
		description: 'Number of steps that were skipped (offline devices)',
		type: 'integer',
	})
	@Expose({ name: 'steps_skipped' })
	stepsSkipped: number;

	@ApiPropertyOptional({
		name: 'step_results',
		description: 'Detailed results for each step',
		type: 'array',
		items: { $ref: getSchemaPath(MediaExecutionStepResultModel) },
	})
	@Expose({ name: 'step_results' })
	@Type(() => MediaExecutionStepResultModel)
	stepResults?: MediaExecutionStepResultModel[];

	@ApiPropertyOptional({
		name: 'offline_device_ids',
		description: 'IDs of devices that were offline',
		type: 'array',
		items: { type: 'string', format: 'uuid' },
	})
	@Expose({ name: 'offline_device_ids' })
	offlineDeviceIds?: string[];
}

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

/**
 * Response wrapper for routing activation result
 */
@ApiSchema({ name: 'SpacesModuleResMediaRoutingActivation' })
export class MediaRoutingActivationResponseModel extends BaseSuccessResponseModel<MediaRoutingActivationResultModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => MediaRoutingActivationResultModel,
	})
	@Expose()
	@Type(() => MediaRoutingActivationResultModel)
	declare data: MediaRoutingActivationResultModel;
}

/**
 * Current media state for a space (V2 architecture)
 */
@ApiSchema({ name: 'SpacesModuleDataMediaStateV2' })
export class MediaStateV2Model {
	@ApiProperty({
		name: 'has_media',
		description: 'Whether the space has any media devices',
		type: 'boolean',
	})
	@Expose({ name: 'has_media' })
	hasMedia: boolean;

	@ApiPropertyOptional({
		name: 'active_routing_id',
		description: 'ID of the currently active routing (if any)',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'active_routing_id' })
	activeRoutingId?: string;

	@ApiPropertyOptional({
		name: 'active_routing_type',
		description: 'Type of the currently active routing',
		enum: MediaRoutingType,
	})
	@Expose({ name: 'active_routing_type' })
	activeRoutingType?: MediaRoutingType;

	@ApiProperty({
		name: 'any_on',
		description: 'Whether any media device is powered on',
		type: 'boolean',
	})
	@Expose({ name: 'any_on' })
	anyOn: boolean;

	@ApiPropertyOptional({
		name: 'current_volume',
		description: 'Current volume of the active audio endpoint (if any)',
		type: 'integer',
	})
	@Expose({ name: 'current_volume' })
	currentVolume?: number;

	@ApiPropertyOptional({
		name: 'is_muted',
		description: 'Whether the active audio endpoint is muted',
		type: 'boolean',
	})
	@Expose({ name: 'is_muted' })
	isMuted?: boolean;

	@ApiProperty({
		name: 'endpoints_count',
		description: 'Total number of configured endpoints',
		type: 'integer',
	})
	@Expose({ name: 'endpoints_count' })
	endpointsCount: number;

	@ApiProperty({
		name: 'routings_count',
		description: 'Total number of configured routings',
		type: 'integer',
	})
	@Expose({ name: 'routings_count' })
	routingsCount: number;

	@ApiProperty({
		name: 'online_devices_count',
		description: 'Number of online media devices',
		type: 'integer',
	})
	@Expose({ name: 'online_devices_count' })
	onlineDevicesCount: number;

	@ApiProperty({
		name: 'offline_devices_count',
		description: 'Number of offline media devices',
		type: 'integer',
	})
	@Expose({ name: 'offline_devices_count' })
	offlineDevicesCount: number;
}

/**
 * Response wrapper for media state V2
 */
@ApiSchema({ name: 'SpacesModuleResMediaStateV2' })
export class MediaStateV2ResponseModel extends BaseSuccessResponseModel<MediaStateV2Model> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => MediaStateV2Model,
	})
	@Expose()
	@Type(() => MediaStateV2Model)
	declare data: MediaStateV2Model;
}

// ========================
// Active Routing Models
// ========================

/**
 * Active routing state model - represents the current active routing for a space
 */
@ApiSchema({ name: 'SpacesModuleDataActiveMediaRoutingState' })
export class ActiveMediaRoutingStateModel {
	@ApiPropertyOptional({
		name: 'routing_id',
		description: 'ID of the currently active routing (null if no routing active)',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'routing_id' })
	routingId: string | null;

	@ApiPropertyOptional({
		name: 'routing_type',
		description: 'Type of the currently active routing',
		enum: MediaRoutingType,
	})
	@Expose({ name: 'routing_type' })
	routingType?: MediaRoutingType;

	@ApiProperty({
		name: 'activation_state',
		description: 'Current state of the routing activation',
		enum: MediaActivationState,
	})
	@Expose({ name: 'activation_state' })
	activationState: MediaActivationState;

	@ApiPropertyOptional({
		name: 'activated_at',
		description: 'Timestamp when the routing was activated',
		type: 'string',
		format: 'date-time',
	})
	@Expose({ name: 'activated_at' })
	activatedAt?: Date;

	@ApiPropertyOptional({
		name: 'last_error',
		description: 'Last error message if activation failed',
		type: 'string',
	})
	@Expose({ name: 'last_error' })
	lastError?: string;

	@ApiPropertyOptional({
		name: 'steps_executed',
		description: 'Number of execution steps completed',
		type: 'integer',
	})
	@Expose({ name: 'steps_executed' })
	stepsExecuted?: number;

	@ApiPropertyOptional({
		name: 'steps_failed',
		description: 'Number of execution steps that failed',
		type: 'integer',
	})
	@Expose({ name: 'steps_failed' })
	stepsFailed?: number;

	@ApiPropertyOptional({
		name: 'steps_skipped',
		description: 'Number of execution steps skipped',
		type: 'integer',
	})
	@Expose({ name: 'steps_skipped' })
	stepsSkipped?: number;
}

/**
 * Response wrapper for active routing state
 */
@ApiSchema({ name: 'SpacesModuleResActiveMediaRoutingState' })
export class ActiveMediaRoutingStateResponseModel extends BaseSuccessResponseModel<ActiveMediaRoutingStateModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => ActiveMediaRoutingStateModel,
	})
	@Expose()
	@Type(() => ActiveMediaRoutingStateModel)
	declare data: ActiveMediaRoutingStateModel;
}
