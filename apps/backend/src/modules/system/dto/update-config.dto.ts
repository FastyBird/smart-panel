import { Expose } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from '../../config/dto/config.dto';
import { LanguageType, LogLevelType, TimeFormatType } from '../system.constants';
import { SYSTEM_MODULE_NAME } from '../system.constants';

@ApiSchema({ name: 'ConfigModuleUpdateSystem' })
export class UpdateSystemConfigDto extends UpdateModuleConfigDto {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'system-module',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string = SYSTEM_MODULE_NAME;

	// Language settings
	@ApiPropertyOptional({
		description: 'Sets the application language.',
		enum: LanguageType,
		example: LanguageType.ENGLISH,
	})
	@Expose()
	@IsOptional()
	@IsEnum(LanguageType, { message: '[{"field":"language","reason":"Language must be a valid string."}]' })
	language?: LanguageType;

	@ApiPropertyOptional({
		description: 'Sets the timezone.',
		type: 'string',
		example: 'Europe/Prague',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"timezone","reason":"Timezone must be a valid string."}]' })
	timezone?: string;

	@ApiPropertyOptional({
		description: 'Sets the time format.',
		enum: TimeFormatType,
		example: TimeFormatType.HOUR_24,
	})
	@Expose()
	@IsOptional()
	@IsEnum(TimeFormatType, { message: '[{"field":"time_format","reason":"Time format must be a valid string."}]' })
	time_format?: TimeFormatType;

	// System settings
	@ApiPropertyOptional({
		description: 'Array of log levels to enable.',
		type: 'array',
		items: {
			type: 'string',
			enum: Object.values(LogLevelType),
		},
		example: ['error', 'warn', 'info'],
	})
	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"log_levels","reason":"Log levels must be provided as an array."}]' })
	@ArrayNotEmpty({ message: '[{"field":"log_levels","reason":"At least one log level must be specified."}]' })
	@IsEnum(LogLevelType, {
		each: true,
		message: '[{"field":"log_levels","reason":"Each log level must be one of the predefined values."}]',
	})
	log_levels?: LogLevelType[];
}
