import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { TriggerType } from '../scenes.constants';

@ApiSchema({ name: 'ScenesModuleUpdateSceneTrigger' })
export class UpdateSceneTriggerDto {
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

	@ApiPropertyOptional({
		description: 'Trigger configuration (type-specific)',
		type: 'object',
		additionalProperties: true,
		example: { cron: '0 8 * * *' },
	})
	@Expose()
	@IsOptional()
	@IsObject({ message: '[{"field":"configuration","reason":"Configuration must be a valid object."}]' })
	configuration?: Record<string, unknown>;

	@ApiPropertyOptional({ description: 'Whether trigger is enabled', type: 'boolean', example: true })
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled attribute must be a valid true or false."}]' })
	enabled?: boolean;
}

@ApiSchema({ name: 'ScenesModuleReqUpdateSceneTrigger' })
export class ReqUpdateSceneTriggerDto {
	@ApiProperty({ description: 'Trigger data', type: () => UpdateSceneTriggerDto })
	@Expose()
	@ValidateNested()
	@Type(() => UpdateSceneTriggerDto)
	data: UpdateSceneTriggerDto;
}
