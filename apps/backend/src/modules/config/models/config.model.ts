import { Expose, Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

// LanguageConfigModel and SystemConfigModel moved to system module

@ApiSchema({ name: 'ConfigModuleDataPlugin' })
export abstract class PluginConfigModel {
	@ApiProperty({
		description: 'Plugin identifier',
		type: 'string',
		example: 'devices-shelly',
	})
	@Expose()
	@IsString()
	type: string;

	@ApiProperty({
		description: 'Plugin enabled state',
		type: 'boolean',
		example: false,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = false;
}

@ApiSchema({ name: 'ConfigModuleDataModule' })
export abstract class ModuleConfigModel {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'devices-module',
	})
	@Expose()
	@IsString()
	type: string;

	@ApiProperty({
		description: 'Module enabled state',
		type: 'boolean',
		example: false,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = false;
}

@ApiSchema({ name: 'ConfigModuleDataApp' })
export class AppConfigModel {
	@ApiProperty({
		description: 'Configuration file path',
		type: 'string',
		example: '/path/to/config.json',
	})
	@Expose()
	@IsString()
	path: string;

	// Language and system configuration moved to system module (accessible via /config/module/system-module)

	@ApiProperty({
		description: 'Plugin configurations',
		type: 'array',
		items: {
			$ref: getSchemaPath(PluginConfigModel),
		},
	})
	@Expose()
	@ValidateNested({ each: true })
	plugins: PluginConfigModel[] = [];

	@ApiProperty({
		description: 'Module configurations',
		type: 'array',
		items: {
			$ref: getSchemaPath(ModuleConfigModel),
		},
	})
	@Expose()
	@ValidateNested({ each: true })
	modules: ModuleConfigModel[] = [];
}
