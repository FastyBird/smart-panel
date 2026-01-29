import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { SpaceMediaActivityBindingEntity } from '../entities/space-media-activity-binding.entity';

/**
 * A single validation issue for a binding slot
 */
@ApiSchema({ name: 'SpacesModuleDataBindingValidationIssue' })
export class BindingValidationIssueModel {
	@ApiPropertyOptional({
		description: 'The binding slot name, or null for general issues',
		type: 'string',
		nullable: true,
	})
	@Expose()
	slot: string | null;

	@ApiProperty({
		description: 'Severity level of the issue',
		type: 'string',
		enum: ['error', 'warning', 'info'],
	})
	@Expose()
	severity: 'error' | 'warning' | 'info';

	@ApiProperty({
		description: 'Human-readable issue description',
		type: 'string',
	})
	@Expose()
	message: string;
}

/**
 * Validation report for a single activity binding
 */
@ApiSchema({ name: 'SpacesModuleDataBindingValidationReport' })
export class BindingValidationReportModel {
	@ApiProperty({
		name: 'activity_key',
		description: 'Activity key this report covers',
		type: 'string',
	})
	@Expose({ name: 'activity_key' })
	activityKey: string;

	@ApiPropertyOptional({
		name: 'binding_id',
		description: 'Binding ID, or null if no binding exists',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'binding_id' })
	bindingId: string | null;

	@ApiProperty({
		description: 'Whether the binding is valid (no errors)',
		type: 'boolean',
	})
	@Expose()
	valid: boolean;

	@ApiProperty({
		description: 'List of validation issues',
		type: 'array',
		items: { $ref: getSchemaPath(BindingValidationIssueModel) },
	})
	@Expose()
	@Type(() => BindingValidationIssueModel)
	issues: BindingValidationIssueModel[];
}

/**
 * Response model for binding validation reports
 */
@ApiSchema({ name: 'SpacesModuleResBindingValidation' })
export class BindingValidationResponseModel extends BaseSuccessResponseModel<BindingValidationReportModel[]> {
	@ApiProperty({
		description: 'Validation report data',
		type: 'array',
		items: { $ref: getSchemaPath(BindingValidationReportModel) },
	})
	@Expose()
	@Type(() => BindingValidationReportModel)
	declare data: BindingValidationReportModel[];
}

/**
 * Response model for a single media activity binding
 */
@ApiSchema({ name: 'SpacesModuleResMediaActivityBinding' })
export class MediaActivityBindingResponseModel extends BaseSuccessResponseModel<SpaceMediaActivityBindingEntity> {
	@ApiProperty({
		description: 'The activity binding data',
		type: () => SpaceMediaActivityBindingEntity,
	})
	@Expose()
	@Type(() => SpaceMediaActivityBindingEntity)
	declare data: SpaceMediaActivityBindingEntity;
}

/**
 * Response model for a list of media activity bindings
 */
@ApiSchema({ name: 'SpacesModuleResMediaActivityBindings' })
export class MediaActivityBindingsResponseModel extends BaseSuccessResponseModel<SpaceMediaActivityBindingEntity[]> {
	@ApiProperty({
		description: 'The activity bindings data',
		type: 'array',
		items: { $ref: getSchemaPath(SpaceMediaActivityBindingEntity) },
	})
	@Expose()
	@Type(() => SpaceMediaActivityBindingEntity)
	declare data: SpaceMediaActivityBindingEntity[];
}
