import { Expose, Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

// UpdateLanguageConfigDto and UpdateSystemConfigDto moved to system module
// Section-based DTOs are deprecated - use module DTOs instead

/**
 * @deprecated Section-based update DTO is deprecated. Use ReqUpdateModuleDto instead.
 */
@ApiSchema({ name: 'ConfigModuleReqUpdateSection' })
export class ReqUpdateSectionDto {
	@ApiProperty({
		description: 'Configuration section data (deprecated - section endpoints are deprecated)',
	})
	@Expose()
	@ValidateNested()
	data: unknown;
}

@ApiSchema({ name: 'ConfigModuleUpdatePlugin' })
export class UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin identifier',
		type: 'string',
		example: 'devices-shelly',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string;

	@ApiPropertyOptional({
		description: 'Enables or disables the plugin.',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled must be a boolean value."}]' })
	enabled?: boolean;
}

@ApiSchema({ name: 'ConfigModuleReqUpdatePlugin' })
export class ReqUpdatePluginDto {
	@ApiProperty({
		description: 'Plugin configuration data',
		type: () => UpdatePluginConfigDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => UpdatePluginConfigDto)
	data: UpdatePluginConfigDto;
}

@ApiSchema({ name: 'ConfigModuleUpdateModule' })
export class UpdateModuleConfigDto {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'devices-module',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string;

	@ApiPropertyOptional({
		description: 'Enables or disables the module.',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled must be a boolean value."}]' })
	enabled?: boolean;
}

@ApiSchema({ name: 'ConfigModuleReqUpdateModule' })
export class ReqUpdateModuleDto {
	@ApiProperty({
		description: 'Module configuration data',
		type: () => UpdateModuleConfigDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => UpdateModuleConfigDto)
	data: UpdateModuleConfigDto;
}
