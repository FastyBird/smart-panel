import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';

@ApiSchema({ name: 'ConfigModuleDataValidationError' })
export class ConfigValidationErrorModel {
	@ApiProperty({
		description: 'Human-readable error message',
		type: 'string',
		example: 'Cannot connect to server',
	})
	@Expose()
	@IsString()
	message: string;

	@ApiPropertyOptional({
		description: 'Field that caused the error',
		type: 'string',
		example: 'mqtt_server',
	})
	@Expose()
	@IsOptional()
	@IsString()
	field?: string;
}

@ApiSchema({ name: 'ConfigModuleDataValidationResult' })
export class ConfigValidationResultModel {
	@ApiProperty({
		description: 'Whether the configuration is valid',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	valid: boolean;

	@ApiPropertyOptional({
		description: 'Validation errors (present when valid is false)',
		type: [ConfigValidationErrorModel],
	})
	@Expose()
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ConfigValidationErrorModel)
	errors?: ConfigValidationErrorModel[];
}

@ApiSchema({ name: 'ConfigModuleResPluginConfigValidation' })
export class ConfigModuleResPluginConfigValidation extends BaseSuccessResponseModel<ConfigValidationResultModel> {
	@ApiProperty({
		description: 'Plugin configuration validation result',
		type: () => ConfigValidationResultModel,
	})
	@Expose()
	declare data: ConfigValidationResultModel;
}
