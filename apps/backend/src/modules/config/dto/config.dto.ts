import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

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
