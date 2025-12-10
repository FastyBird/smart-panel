import { Expose } from 'class-transformer';
import { IsEnum, IsInt, IsString, Min } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import { DeploymentMode, DISPLAYS_MODULE_NAME, PERMIT_JOIN_DEFAULT_DURATION_MS } from '../displays.constants';

@ApiSchema({ name: 'ConfigModuleDataDisplays' })
export class DisplaysConfigModel extends ModuleConfigModel {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'displays',
	})
	@Expose()
	@IsString()
	type: string = DISPLAYS_MODULE_NAME;

	@ApiProperty({
		name: 'deployment_mode',
		description: 'Deployment mode for display registration',
		enum: DeploymentMode,
		example: DeploymentMode.COMBINED,
	})
	@Expose({ name: 'deployment_mode' })
	@IsEnum(DeploymentMode)
	deploymentMode: DeploymentMode = DeploymentMode.COMBINED;

	@ApiProperty({
		name: 'permit_join_duration_ms',
		description: 'Duration in milliseconds that permit join remains active',
		type: 'integer',
		minimum: 1000,
		example: 120000,
	})
	@Expose({ name: 'permit_join_duration_ms' })
	@IsInt()
	@Min(1000)
	permitJoinDurationMs: number = PERMIT_JOIN_DEFAULT_DURATION_MS;
}
