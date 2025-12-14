import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { SceneExecutionStatus } from '../scenes.constants';

/**
 * Result of individual action execution
 */
@ApiSchema({ name: 'ScenesModuleDataActionExecutionResult' })
export class ActionExecutionResultModel {
	@ApiProperty({
		name: 'action_id',
		description: 'ID of the executed action',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose({ name: 'action_id' })
	@IsUUID('4')
	actionId: string;

	@ApiProperty({ description: 'Whether the action executed successfully', type: 'boolean', example: true })
	@Expose()
	@IsBoolean()
	success: boolean;

	@ApiPropertyOptional({
		description: 'Error message if action failed',
		type: 'string',
		nullable: true,
		example: 'Device not reachable',
	})
	@Expose()
	@IsOptional()
	@IsString()
	error?: string | null;

	@ApiProperty({
		name: 'execution_time_ms',
		description: 'Time taken to execute action in milliseconds',
		type: 'number',
		example: 150,
	})
	@Expose({ name: 'execution_time_ms' })
	executionTimeMs: number;
}

/**
 * Result of scene execution
 */
@ApiSchema({ name: 'ScenesModuleDataSceneExecutionResult' })
export class SceneExecutionResultModel {
	@ApiProperty({
		name: 'scene_id',
		description: 'ID of the executed scene',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose({ name: 'scene_id' })
	@IsUUID('4')
	sceneId: string;

	@ApiProperty({
		description: 'Execution status',
		enum: SceneExecutionStatus,
		example: SceneExecutionStatus.COMPLETED,
	})
	@Expose()
	@IsEnum(SceneExecutionStatus)
	status: SceneExecutionStatus;

	@ApiProperty({
		name: 'triggered_at',
		description: 'Timestamp when scene was triggered',
		type: 'string',
		format: 'date-time',
		example: '2025-01-25T12:00:00Z',
	})
	@Expose({ name: 'triggered_at' })
	triggeredAt: string;

	@ApiPropertyOptional({
		name: 'completed_at',
		description: 'Timestamp when execution completed',
		type: 'string',
		format: 'date-time',
		nullable: true,
		example: '2025-01-25T12:00:01Z',
	})
	@Expose({ name: 'completed_at' })
	@IsOptional()
	completedAt?: string | null;

	@ApiPropertyOptional({
		name: 'triggered_by',
		description: 'Source that triggered the scene',
		type: 'string',
		nullable: true,
		example: 'manual',
	})
	@Expose({ name: 'triggered_by' })
	@IsOptional()
	@IsString()
	triggeredBy?: string | null;

	@ApiProperty({
		name: 'total_actions',
		description: 'Total number of actions in the scene',
		type: 'integer',
		example: 3,
	})
	@Expose({ name: 'total_actions' })
	totalActions: number;

	@ApiProperty({
		name: 'successful_actions',
		description: 'Number of successfully executed actions',
		type: 'integer',
		example: 3,
	})
	@Expose({ name: 'successful_actions' })
	successfulActions: number;

	@ApiProperty({
		name: 'failed_actions',
		description: 'Number of failed actions',
		type: 'integer',
		example: 0,
	})
	@Expose({ name: 'failed_actions' })
	failedActions: number;

	@ApiProperty({
		name: 'action_results',
		description: 'Results of individual action executions',
		type: 'array',
		items: { $ref: getSchemaPath(ActionExecutionResultModel) },
	})
	@Expose({ name: 'action_results' })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ActionExecutionResultModel)
	actionResults: ActionExecutionResultModel[];

	@ApiPropertyOptional({
		description: 'Error message if execution failed',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@IsString()
	error?: string | null;
}
