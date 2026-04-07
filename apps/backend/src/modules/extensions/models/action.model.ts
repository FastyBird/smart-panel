import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDate, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'ExtensionsModuleDataActionParameterValidation' })
export class ActionParameterValidationModel {
	@ApiPropertyOptional({ description: 'Minimum value (for number parameters)', type: 'number' })
	@Expose()
	@IsNumber()
	@IsOptional()
	min?: number;

	@ApiPropertyOptional({ description: 'Maximum value (for number parameters)', type: 'number' })
	@Expose()
	@IsNumber()
	@IsOptional()
	max?: number;

	@ApiPropertyOptional({ description: 'Regex pattern (for string parameters)', type: 'string' })
	@Expose()
	@IsString()
	@IsOptional()
	pattern?: string;

	@ApiPropertyOptional({ description: 'Minimum length (for string parameters)', type: 'number' })
	@Expose({ name: 'min_length' })
	@IsNumber()
	@IsOptional()
	minLength?: number;

	@ApiPropertyOptional({ description: 'Maximum length (for string parameters)', type: 'number' })
	@Expose({ name: 'max_length' })
	@IsNumber()
	@IsOptional()
	maxLength?: number;
}

@ApiSchema({ name: 'ExtensionsModuleDataActionParameterOption' })
export class ActionParameterOptionModel {
	@ApiProperty({ description: 'Display label', type: 'string' })
	@Expose()
	@IsString()
	label: string;

	@ApiProperty({
		description: 'Option value',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
	})
	@Expose()
	value: string | number | boolean;
}

@ApiSchema({ name: 'ExtensionsModuleDataActionParameter' })
export class ActionParameterModel {
	@ApiProperty({ description: 'Parameter key', type: 'string', example: 'scenario' })
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({ description: 'Human-readable label', type: 'string', example: 'Scenario' })
	@Expose()
	@IsString()
	label: string;

	@ApiPropertyOptional({ description: 'Help text', type: 'string' })
	@Expose()
	@IsString()
	@IsOptional()
	description?: string;

	@ApiProperty({
		description: 'Parameter type (determines UI form control)',
		type: 'string',
		enum: ['string', 'number', 'boolean', 'select', 'multi_select'],
		example: 'select',
	})
	@Expose()
	@IsString()
	type: string;

	@ApiPropertyOptional({ description: 'Whether the parameter is required', type: 'boolean' })
	@Expose()
	@IsBoolean()
	@IsOptional()
	required?: boolean;

	@ApiPropertyOptional({
		description: 'Default value',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
	})
	@Expose()
	@IsOptional()
	default?: string | number | boolean;

	@ApiPropertyOptional({
		description: 'Available options (for select/multi_select)',
		type: [ActionParameterOptionModel],
	})
	@Expose()
	@Type(() => ActionParameterOptionModel)
	@IsArray()
	@IsOptional()
	options?: ActionParameterOptionModel[];

	@ApiPropertyOptional({
		description: 'Validation constraints',
		type: () => ActionParameterValidationModel,
	})
	@Expose()
	@Type(() => ActionParameterValidationModel)
	@IsOptional()
	validation?: ActionParameterValidationModel;
}

@ApiSchema({ name: 'ExtensionsModuleDataAction' })
export class ExtensionActionModel {
	@ApiProperty({ description: 'Unique action ID', type: 'string', example: 'load-scenario' })
	@Expose()
	@IsString()
	id: string;

	@ApiProperty({ description: 'Human-readable name', type: 'string', example: 'Load Scenario' })
	@Expose()
	@IsString()
	label: string;

	@ApiPropertyOptional({ description: 'Description of what the action does', type: 'string' })
	@Expose()
	@IsString()
	@IsOptional()
	description?: string;

	@ApiPropertyOptional({ description: 'MDI icon name', type: 'string', example: 'mdi:play' })
	@Expose()
	@IsString()
	@IsOptional()
	icon?: string;

	@ApiPropertyOptional({
		description: 'Action category for UI grouping',
		type: 'string',
		enum: ['general', 'simulation', 'data', 'diagnostics', 'maintenance'],
	})
	@Expose()
	@IsString()
	@IsOptional()
	category?: string;

	@ApiProperty({
		description: 'Execution mode: immediate (REST) or interactive (WebSocket, future)',
		type: 'string',
		enum: ['immediate', 'interactive'],
		example: 'immediate',
	})
	@Expose()
	@IsString()
	mode: string;

	@ApiPropertyOptional({ description: 'Whether the action requires confirmation', type: 'boolean' })
	@Expose()
	@IsBoolean()
	@IsOptional()
	dangerous?: boolean;

	@ApiPropertyOptional({
		name: 'required_roles',
		description: 'User roles allowed to execute this action',
		type: 'array',
		items: { type: 'string' },
		example: ['owner', 'admin'],
	})
	@Expose({ name: 'required_roles' })
	@IsArray()
	@IsOptional()
	requiredRoles?: string[];

	@ApiPropertyOptional({
		description: 'Whether the current user is allowed to execute this action',
		type: 'boolean',
	})
	@Expose()
	@IsBoolean()
	@IsOptional()
	allowed?: boolean;

	@ApiPropertyOptional({
		description: 'Action parameters',
		type: [ActionParameterModel],
	})
	@Expose()
	@Type(() => ActionParameterModel)
	@IsArray()
	@IsOptional()
	parameters?: ActionParameterModel[];
}

@ApiSchema({ name: 'ExtensionsModuleDataActionResult' })
export class ActionResultModel {
	@ApiProperty({ description: 'Whether the action succeeded', type: 'boolean' })
	@Expose()
	@IsBoolean()
	success: boolean;

	@ApiPropertyOptional({ description: 'Summary message', type: 'string' })
	@Expose()
	@IsString()
	@IsOptional()
	message?: string;

	@ApiPropertyOptional({
		description: 'Optional structured data',
		type: 'object',
		additionalProperties: true,
	})
	@Expose()
	@IsObject()
	@IsOptional()
	data?: Record<string, unknown>;
}

@ApiSchema({ name: 'ExtensionsModuleDataActionExecutionRecord' })
export class ActionExecutionRecordModel {
	@ApiProperty({ description: 'Record ID', type: 'string' })
	@Expose()
	@IsString()
	id: string;

	@ApiProperty({ name: 'extension_type', description: 'Extension type', type: 'string' })
	@Expose({ name: 'extension_type' })
	@IsString()
	extensionType: string;

	@ApiProperty({ name: 'action_id', description: 'Action ID', type: 'string' })
	@Expose({ name: 'action_id' })
	@IsString()
	actionId: string;

	@ApiPropertyOptional({ name: 'user_id', description: 'User who executed the action', type: 'string', nullable: true })
	@Expose({ name: 'user_id' })
	@IsString()
	@IsOptional()
	userId: string | null;

	@ApiPropertyOptional({ name: 'user_role', description: 'Role of the user', type: 'string', nullable: true })
	@Expose({ name: 'user_role' })
	@IsString()
	@IsOptional()
	userRole: string | null;

	@ApiProperty({ description: 'Whether the action succeeded', type: 'boolean' })
	@Expose()
	@IsBoolean()
	success: boolean;

	@ApiPropertyOptional({ description: 'Result message', type: 'string', nullable: true })
	@Expose()
	@IsString()
	@IsOptional()
	message: string | null;

	@ApiProperty({ name: 'duration_ms', description: 'Execution duration in milliseconds', type: 'number' })
	@Expose({ name: 'duration_ms' })
	@IsNumber()
	durationMs: number;

	@ApiProperty({ description: 'Execution timestamp', type: 'string', format: 'date-time' })
	@Expose()
	@IsDate()
	timestamp: Date;
}
