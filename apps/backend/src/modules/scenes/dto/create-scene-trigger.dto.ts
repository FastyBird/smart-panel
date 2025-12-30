import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { TriggerType } from '../scenes.constants';

@ApiSchema({ name: 'ScenesModuleCreateSceneTrigger' })
export class CreateSceneTriggerDto {
	@ApiPropertyOptional({
		description: 'Trigger ID',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id?: string;

	@ApiProperty({ description: 'Trigger type (plugin identifier)', type: 'string', example: 'schedule' })
	@Expose()
	@IsNotEmpty({
		message: '[{"field":"type","reason":"Type must be a valid string representing a supported trigger type."}]',
	})
	@IsString({
		message: '[{"field":"type","reason":"Type must be a valid string representing a supported trigger type."}]',
	})
	type: string;

	@ApiPropertyOptional({
		name: 'trigger_type',
		description: 'Type of trigger mechanism',
		enum: TriggerType,
		example: TriggerType.SCHEDULE,
	})
	@Expose({ name: 'trigger_type' })
	@IsOptional()
	@IsEnum(TriggerType, {
		message: '[{"field":"trigger_type","reason":"Trigger type must be a valid trigger type."}]',
	})
	triggerType?: TriggerType;

	@ApiProperty({
		description: 'Trigger configuration (type-specific)',
		type: 'object',
		additionalProperties: true,
		example: { cron: '0 8 * * *' },
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"configuration","reason":"Configuration must be provided."}]' })
	@IsObject({ message: '[{"field":"configuration","reason":"Configuration must be a valid object."}]' })
	configuration: Record<string, unknown>;

	@ApiPropertyOptional({ description: 'Whether trigger is enabled', type: 'boolean', example: true })
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled attribute must be a valid true or false."}]' })
	enabled?: boolean;
}

@ApiSchema({ name: 'ScenesModuleReqCreateSceneTrigger' })
export class ReqCreateSceneTriggerDto {
	@ApiProperty({ description: 'Trigger data', type: () => CreateSceneTriggerDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreateSceneTriggerDto)
	data: CreateSceneTriggerDto;
}
