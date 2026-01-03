import { Expose, Type } from 'class-transformer';
import { IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'ScenesModuleTriggerScene' })
export class TriggerSceneDto {
	@ApiPropertyOptional({
		description: 'Source of the trigger (for logging/tracking)',
		type: 'string',
		example: 'manual',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"source","reason":"Source must be a valid string."}]' })
	source?: string;

	@ApiPropertyOptional({
		description: 'Additional context for the trigger',
		type: 'object',
		additionalProperties: true,
		example: { userId: 'uuid' },
	})
	@Expose()
	@IsOptional()
	@IsObject({ message: '[{"field":"context","reason":"Context must be a valid object."}]' })
	context?: Record<string, unknown>;
}

@ApiSchema({ name: 'ScenesModuleReqTriggerScene' })
export class ReqTriggerSceneDto {
	@ApiProperty({ description: 'Trigger data', type: () => TriggerSceneDto })
	@Expose()
	@ValidateNested()
	@Type(() => TriggerSceneDto)
	data: TriggerSceneDto;
}
