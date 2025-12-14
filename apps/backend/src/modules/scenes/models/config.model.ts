import { Expose } from 'class-transformer';
import { IsBoolean, IsInt, IsString, Max, Min } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import {
	DEFAULT_EXECUTION_TIMEOUT_MS,
	DEFAULT_MAX_CONCURRENT_EXECUTIONS,
	SCENES_MODULE_NAME,
} from '../scenes.constants';

@ApiSchema({ name: 'ConfigModuleDataScenes' })
export class ScenesConfigModel extends ModuleConfigModel {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'scenes-module',
	})
	@Expose()
	@IsString()
	type: string = SCENES_MODULE_NAME;

	@ApiProperty({
		name: 'execution_timeout_ms',
		description: 'Timeout in milliseconds for scene execution',
		type: 'integer',
		minimum: 1000,
		maximum: 300000,
		example: 30000,
	})
	@Expose({ name: 'execution_timeout_ms' })
	@IsInt()
	@Min(1000)
	@Max(300000)
	executionTimeoutMs: number = DEFAULT_EXECUTION_TIMEOUT_MS;

	@ApiProperty({
		name: 'max_concurrent_executions',
		description: 'Maximum number of scenes that can execute concurrently',
		type: 'integer',
		minimum: 1,
		maximum: 100,
		example: 10,
	})
	@Expose({ name: 'max_concurrent_executions' })
	@IsInt()
	@Min(1)
	@Max(100)
	maxConcurrentExecutions: number = DEFAULT_MAX_CONCURRENT_EXECUTIONS;

	@ApiProperty({
		name: 'continue_on_action_failure',
		description: 'Whether to continue executing remaining actions if one fails',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'continue_on_action_failure' })
	@IsBoolean()
	continueOnActionFailure: boolean = true;
}
