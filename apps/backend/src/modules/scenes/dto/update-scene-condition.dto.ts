import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ConditionOperator } from '../scenes.constants';

@ApiSchema({ name: 'ScenesModuleUpdateSceneCondition' })
export class UpdateSceneConditionDto {
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

	@ApiPropertyOptional({
		description: 'Condition configuration (plugin-specific)',
		type: 'object',
		additionalProperties: true,
		example: { deviceId: 'uuid', propertyId: 'uuid', operator: 'eq', value: true },
	})
	@Expose()
	@IsOptional()
	@IsObject({ message: '[{"field":"configuration","reason":"Configuration must be a valid object."}]' })
	configuration?: Record<string, unknown>;

	@ApiPropertyOptional({ description: 'Whether condition is enabled', type: 'boolean', example: true })
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled attribute must be a valid true or false."}]' })
	enabled?: boolean;
}

@ApiSchema({ name: 'ScenesModuleReqUpdateSceneCondition' })
export class ReqUpdateSceneConditionDto {
	@ApiProperty({ description: 'Condition data', type: () => UpdateSceneConditionDto })
	@Expose()
	@ValidateNested()
	@Type(() => UpdateSceneConditionDto)
	data: UpdateSceneConditionDto;
}
