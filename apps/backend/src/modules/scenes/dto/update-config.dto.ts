import { Expose } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from '../../config/dto/config.dto';
import { SCENES_MODULE_NAME } from '../scenes.constants';

@ApiSchema({ name: 'ConfigModuleUpdateScenes' })
export class UpdateScenesConfigDto extends UpdateModuleConfigDto {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'scenes-module',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string = SCENES_MODULE_NAME;

	@ApiPropertyOptional({
		name: 'execution_timeout_ms',
		description: 'Timeout in milliseconds for scene execution.',
		type: 'integer',
		minimum: 1000,
		maximum: 300000,
		example: 30000,
	})
	@Expose({ name: 'execution_timeout_ms' })
	@IsOptional()
	@IsInt({ message: '[{"field":"execution_timeout_ms","reason":"Execution timeout must be a valid integer."}]' })
	@Min(1000, {
		message: '[{"field":"execution_timeout_ms","reason":"Execution timeout must be at least 1000ms."}]',
	})
	@Max(300000, {
		message: '[{"field":"execution_timeout_ms","reason":"Execution timeout must be at most 300000ms."}]',
	})
	execution_timeout_ms?: number;

	@ApiPropertyOptional({
		name: 'max_concurrent_executions',
		description: 'Maximum number of scenes that can execute concurrently.',
		type: 'integer',
		minimum: 1,
		maximum: 100,
		example: 10,
	})
	@Expose({ name: 'max_concurrent_executions' })
	@IsOptional()
	@IsInt({
		message: '[{"field":"max_concurrent_executions","reason":"Max concurrent executions must be a valid integer."}]',
	})
	@Min(1, {
		message: '[{"field":"max_concurrent_executions","reason":"Max concurrent executions must be at least 1."}]',
	})
	@Max(100, {
		message: '[{"field":"max_concurrent_executions","reason":"Max concurrent executions must be at most 100."}]',
	})
	max_concurrent_executions?: number;

	@ApiPropertyOptional({
		name: 'continue_on_action_failure',
		description: 'Whether to continue executing remaining actions if one fails.',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'continue_on_action_failure' })
	@IsOptional()
	@IsBoolean({
		message: '[{"field":"continue_on_action_failure","reason":"Continue on action failure must be a boolean."}]',
	})
	continue_on_action_failure?: boolean;
}
