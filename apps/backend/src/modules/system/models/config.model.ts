import { Expose } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEnum, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import { LanguageType, LogLevelType, TimeFormatType } from '../system.constants';
import { SYSTEM_MODULE_NAME } from '../system.constants';

@ApiSchema({ name: 'ConfigModuleDataSystem' })
export class SystemConfigModel extends ModuleConfigModel {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'system-module',
	})
	@Expose()
	@IsString()
	type: string = SYSTEM_MODULE_NAME;

	// Language settings
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

	// System settings
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
