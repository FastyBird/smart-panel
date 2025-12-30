import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ConditionOperator } from '../scenes.constants';

@ApiSchema({ name: 'ScenesModuleCreateSceneCondition' })
export class CreateSceneConditionDto {
	@ApiPropertyOptional({
		description: 'Condition ID',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id?: string;

	@ApiProperty({ description: 'Condition type (plugin identifier)', type: 'string', example: 'device-state' })
	@Expose()
	@IsNotEmpty({
		message: '[{"field":"type","reason":"Type must be a valid string representing a supported condition type."}]',
	})
	@IsString({
		message: '[{"field":"type","reason":"Type must be a valid string representing a supported condition type."}]',
	})
	type: string;

	@ApiPropertyOptional({
		description: 'Logical operator with other conditions',
		enum: ConditionOperator,
		example: ConditionOperator.AND,
	})
	@Expose()
	@IsOptional()
	@IsEnum(ConditionOperator, {
		message: '[{"field":"operator","reason":"Operator must be a valid condition operator (and/or)."}]',
	})
	operator?: ConditionOperator;

	@ApiProperty({
		description: 'Condition configuration (plugin-specific)',
		type: 'object',
		additionalProperties: true,
		example: { deviceId: 'uuid', propertyId: 'uuid', operator: 'eq', value: true },
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"configuration","reason":"Configuration must be provided."}]' })
	@IsObject({ message: '[{"field":"configuration","reason":"Configuration must be a valid object."}]' })
	configuration: Record<string, unknown>;

	@ApiPropertyOptional({ description: 'Whether condition is enabled', type: 'boolean', example: true })
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled attribute must be a valid true or false."}]' })
	enabled?: boolean;
}

@ApiSchema({ name: 'ScenesModuleReqCreateSceneCondition' })
export class ReqCreateSceneConditionDto {
	@ApiProperty({ description: 'Condition data', type: () => CreateSceneConditionDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreateSceneConditionDto)
	data: CreateSceneConditionDto;
}
