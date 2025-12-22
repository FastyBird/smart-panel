import { Expose } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from '../../config/dto/config.dto';
import { DISPLAYS_MODULE_NAME, DeploymentMode } from '../displays.constants';

@ApiSchema({ name: 'ConfigModuleUpdateDisplays' })
export class UpdateDisplaysConfigDto extends UpdateModuleConfigDto {
	override enabled = true;

	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'displays',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string = DISPLAYS_MODULE_NAME;

	@ApiPropertyOptional({
		name: 'deployment_mode',
		description: 'Deployment mode for display registration.',
		enum: DeploymentMode,
		example: DeploymentMode.COMBINED,
	})
	@Expose({ name: 'deployment_mode' })
	@IsOptional()
	@IsEnum(DeploymentMode, {
		message: '[{"field":"deployment_mode","reason":"Deployment mode must be a valid enum value."}]',
	})
	deployment_mode?: DeploymentMode;

	@ApiPropertyOptional({
		name: 'permit_join_duration_ms',
		description: 'Duration in milliseconds that permit join remains active.',
		type: 'integer',
		minimum: 1000,
		example: 120000,
	})
	@Expose({ name: 'permit_join_duration_ms' })
	@IsOptional()
	@IsInt({ message: '[{"field":"permit_join_duration_ms","reason":"Permit join duration must be a valid integer."}]' })
	@Min(1000, {
		message: '[{"field":"permit_join_duration_ms","reason":"Permit join duration must be at least 1000ms."}]',
	})
	permit_join_duration_ms?: number;
}
