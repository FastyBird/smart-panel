import { Expose, Type } from 'class-transformer';
import {
	ArrayNotEmpty,
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	Max,
	Min,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import {
	LanguageType,
	LogLevelType,
	SectionType,
	TemperatureUnitType,
	TimeFormatType,
	WeatherLocationType,
} from '../config.constants';

@ApiSchema({ name: 'ConfigModuleDataBase' })
export abstract class BaseConfigModel {
	@ApiProperty({
		description: 'Configuration section type',
		enum: SectionType,
	})
	@Expose()
	type?: SectionType;
}

@ApiSchema({ name: 'ConfigModuleDataLanguage' })
export class LanguageConfigModel extends BaseConfigModel {
	@ApiProperty({
		description: 'Configuration section type',
		enum: [SectionType.LANGUAGE],
		example: 'language',
	})
	@Expose()
	@IsOptional()
	type = SectionType.LANGUAGE;

	@ApiProperty({
		description: 'Application language',
		enum: LanguageType,
		example: LanguageType.ENGLISH,
	})
	@Expose()
	@IsEnum(LanguageType)
	language: LanguageType = LanguageType.ENGLISH;

	@ApiProperty({
		description: 'Timezone',
		type: 'string',
		example: 'Europe/Prague',
	})
	@Expose()
	@IsString()
	timezone: string = 'Europe/Prague';

	@ApiProperty({
		name: 'time_format',
		description: 'Time format',
		enum: TimeFormatType,
		example: TimeFormatType.HOUR_24,
	})
	@Expose({ name: 'time_format' })
	@IsEnum(TimeFormatType)
	timeFormat: TimeFormatType = TimeFormatType.HOUR_24;
}

@ApiSchema({ name: 'ConfigModuleDataSystem' })
export class SystemConfigModel extends BaseConfigModel {
	@ApiProperty({
		description: 'Configuration section type',
		enum: [SectionType.SYSTEM],
		example: 'system',
	})
	@Expose()
	@IsOptional()
	type = SectionType.SYSTEM;

	@ApiProperty({
		name: 'log_levels',
		description: 'Array of enabled log levels',
		type: 'array',
		items: {
			type: 'string',
			enum: Object.values(LogLevelType),
		},
		example: [LogLevelType.INFO, LogLevelType.WARN, LogLevelType.ERROR, LogLevelType.FATAL],
	})
	@Expose({ name: 'log_levels' })
	@IsArray()
	@ArrayNotEmpty()
	@IsEnum(LogLevelType, { each: true })
	logLevels: LogLevelType[] = [LogLevelType.INFO, LogLevelType.WARN, LogLevelType.ERROR, LogLevelType.FATAL];
}

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

	@ApiProperty({
		description: 'Language configuration section',
		type: () => LanguageConfigModel,
	})
	@Expose()
	@ValidateNested()
	@Type(() => LanguageConfigModel)
	language: LanguageConfigModel = new LanguageConfigModel();

	@ApiProperty({
		description: 'System configuration section',
		type: () => SystemConfigModel,
	})
	@Expose()
	@ValidateNested()
	@Type(() => SystemConfigModel)
	system: SystemConfigModel = new SystemConfigModel();

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
