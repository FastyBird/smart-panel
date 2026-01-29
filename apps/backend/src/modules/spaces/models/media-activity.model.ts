import { Expose, Type } from 'class-transformer';

import { ApiExtraModels, ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { SpaceActiveMediaActivityEntity } from '../entities/space-active-media-activity.entity';
import { MediaActivationState, MediaActivityKey } from '../spaces.constants';

// ========================
// Resolved Devices Model
// ========================

@ApiSchema({ name: 'SpacesModuleDataMediaActivityResolved' })
export class MediaActivityResolvedModel {
	@ApiPropertyOptional({
		name: 'display_device_id',
		description: 'Device ID resolved for the display slot',
		type: 'string',
	})
	@Expose({ name: 'display_device_id' })
	displayDeviceId?: string;

	@ApiPropertyOptional({
		name: 'audio_device_id',
		description: 'Device ID resolved for the audio slot',
		type: 'string',
	})
	@Expose({ name: 'audio_device_id' })
	audioDeviceId?: string;

	@ApiPropertyOptional({
		name: 'source_device_id',
		description: 'Device ID resolved for the source slot',
		type: 'string',
	})
	@Expose({ name: 'source_device_id' })
	sourceDeviceId?: string;

	@ApiPropertyOptional({
		name: 'remote_device_id',
		description: 'Device ID resolved for the remote slot',
		type: 'string',
	})
	@Expose({ name: 'remote_device_id' })
	remoteDeviceId?: string;
}

// ========================
// Execution Step Failure
// ========================

@ApiSchema({ name: 'SpacesModuleDataMediaActivityStepFailure' })
export class MediaActivityStepFailureModel {
	@ApiProperty({
		name: 'step_index',
		description: 'Index of the failed step',
		type: 'integer',
	})
	@Expose({ name: 'step_index' })
	stepIndex: number;

	@ApiProperty({
		description: 'Reason for the failure',
		type: 'string',
	})
	@Expose()
	reason: string;

	@ApiPropertyOptional({
		name: 'target_device_id',
		description: 'Device ID that failed',
		type: 'string',
	})
	@Expose({ name: 'target_device_id' })
	targetDeviceId?: string;

	@ApiPropertyOptional({
		name: 'property_id',
		description: 'Property ID that was targeted',
		type: 'string',
	})
	@Expose({ name: 'property_id' })
	propertyId?: string;
}

// ========================
// Last Result Model
// ========================

@ApiSchema({ name: 'SpacesModuleDataMediaActivityLastResult' })
@ApiExtraModels(MediaActivityStepFailureModel)
export class MediaActivityLastResultModel {
	@ApiProperty({
		name: 'steps_total',
		description: 'Total number of steps in the plan',
		type: 'integer',
	})
	@Expose({ name: 'steps_total' })
	stepsTotal: number;

	@ApiProperty({
		name: 'steps_succeeded',
		description: 'Number of steps that succeeded',
		type: 'integer',
	})
	@Expose({ name: 'steps_succeeded' })
	stepsSucceeded: number;

	@ApiProperty({
		name: 'steps_failed',
		description: 'Number of steps that failed',
		type: 'integer',
	})
	@Expose({ name: 'steps_failed' })
	stepsFailed: number;

	@ApiPropertyOptional({
		description: 'Detailed failure information for each failed step',
		type: 'array',
		items: { $ref: getSchemaPath(MediaActivityStepFailureModel) },
	})
	@Expose()
	@Type(() => MediaActivityStepFailureModel)
	failures?: MediaActivityStepFailureModel[];
}

// ========================
// Execution Step Model
// ========================

@ApiSchema({ name: 'SpacesModuleDataMediaActivityExecutionStep' })
export class MediaActivityExecutionStepModel {
	@ApiProperty({
		name: 'target_device_id',
		description: 'ID of the device being controlled',
		type: 'string',
	})
	@Expose({ name: 'target_device_id' })
	targetDeviceId: string;

	@ApiProperty({
		description: 'Action to perform',
		type: 'object',
		additionalProperties: true,
	})
	@Expose()
	action: {
		kind: 'setProperty' | 'sendCommand';
		propertyId?: string;
		commandId?: string;
		value?: unknown;
		payload?: unknown;
	};

	@ApiProperty({
		description: 'Whether this step is critical (failure aborts plan)',
		type: 'boolean',
	})
	@Expose()
	critical: boolean;

	@ApiPropertyOptional({
		description: 'Human-readable label for this step',
		type: 'string',
	})
	@Expose()
	label?: string;
}

// ========================
// Execution Plan Model
// ========================

@ApiSchema({ name: 'SpacesModuleDataMediaActivityExecutionPlan' })
@ApiExtraModels(MediaActivityExecutionStepModel)
export class MediaActivityExecutionPlanModel {
	@ApiProperty({
		name: 'space_id',
		description: 'ID of the space',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'space_id' })
	spaceId: string;

	@ApiProperty({
		name: 'activity_key',
		description: 'Activity being activated',
		enum: MediaActivityKey,
	})
	@Expose({ name: 'activity_key' })
	activityKey: MediaActivityKey;

	@ApiProperty({
		description: 'Resolved device IDs per slot',
		type: () => MediaActivityResolvedModel,
	})
	@Expose()
	@Type(() => MediaActivityResolvedModel)
	resolved: MediaActivityResolvedModel;

	@ApiProperty({
		description: 'Ordered execution steps',
		type: 'array',
		items: { $ref: getSchemaPath(MediaActivityExecutionStepModel) },
	})
	@Expose()
	@Type(() => MediaActivityExecutionStepModel)
	steps: MediaActivityExecutionStepModel[];
}

// ========================
// Activation Result Model
// ========================

@ApiSchema({ name: 'SpacesModuleDataMediaActivityActivationResult' })
export class MediaActivityActivationResultModel {
	@ApiProperty({
		name: 'activity_key',
		description: 'The activity that was activated',
		enum: MediaActivityKey,
		nullable: true,
	})
	@Expose({ name: 'activity_key' })
	activityKey: MediaActivityKey | null;

	@ApiProperty({
		description: 'Current state of the activation',
		enum: MediaActivationState,
	})
	@Expose()
	state: MediaActivationState;

	@ApiPropertyOptional({
		description: 'Resolved device IDs per slot',
		type: () => MediaActivityResolvedModel,
	})
	@Expose()
	@Type(() => MediaActivityResolvedModel)
	resolved?: MediaActivityResolvedModel;

	@ApiPropertyOptional({
		description: 'Execution result summary',
		type: () => MediaActivityLastResultModel,
	})
	@Expose()
	@Type(() => MediaActivityLastResultModel)
	summary?: MediaActivityLastResultModel;

	@ApiPropertyOptional({
		description: 'Warning messages for non-critical failures',
		type: 'array',
		items: { type: 'string' },
	})
	@Expose()
	warnings?: string[];
}

// ========================
// Response Models
// ========================

@ApiSchema({ name: 'SpacesModuleResMediaActivityActivation' })
export class MediaActivityActivationResponseModel extends BaseSuccessResponseModel<MediaActivityActivationResultModel> {
	@ApiProperty({
		description: 'The activation result data',
		type: () => MediaActivityActivationResultModel,
	})
	@Expose()
	@Type(() => MediaActivityActivationResultModel)
	declare data: MediaActivityActivationResultModel;
}

@ApiSchema({ name: 'SpacesModuleResActiveMediaActivity' })
export class ActiveMediaActivityResponseModel extends BaseSuccessResponseModel<SpaceActiveMediaActivityEntity | null> {
	@ApiProperty({
		description: 'The active media activity (null if no activity is active)',
		type: () => SpaceActiveMediaActivityEntity,
		nullable: true,
	})
	@Expose()
	declare data: SpaceActiveMediaActivityEntity | null;
}
