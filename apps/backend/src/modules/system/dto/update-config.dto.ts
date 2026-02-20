import { Expose, Transform } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from '../../config/dto/config.dto';
import { HouseMode, LanguageType, LogLevelType, TemperatureUnitType, TimeFormatType } from '../system.constants';
import { SYSTEM_MODULE_NAME } from '../system.constants';

@ApiSchema({ name: 'ConfigModuleUpdateSystem' })
export class UpdateSystemConfigDto extends UpdateModuleConfigDto {
	override enabled = true;

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
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsEnum(LanguageType, { message: '[{"field":"language","reason":"Language must be a valid string."}]' })
	language?: LanguageType;

	@ApiPropertyOptional({
		description: 'Sets the timezone.',
		type: 'string',
		example: 'Europe/Prague',
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsString({ message: '[{"field":"timezone","reason":"Timezone must be a valid string."}]' })
	timezone?: string;

	@ApiPropertyOptional({
		description: 'Sets the time format.',
		enum: TimeFormatType,
		example: TimeFormatType.HOUR_24,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsEnum(TimeFormatType, { message: '[{"field":"time_format","reason":"Time format must be a valid string."}]' })
	time_format?: TimeFormatType;

	@ApiPropertyOptional({
		description: 'Sets the temperature display unit.',
		enum: TemperatureUnitType,
		example: TemperatureUnitType.CELSIUS,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsEnum(TemperatureUnitType, {
		message: '[{"field":"temperature_unit","reason":"Temperature unit must be celsius or fahrenheit."}]',
	})
	temperature_unit?: TemperatureUnitType;

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
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsArray({ message: '[{"field":"log_levels","reason":"Log levels must be provided as an array."}]' })
	@ArrayNotEmpty({ message: '[{"field":"log_levels","reason":"At least one log level must be specified."}]' })
	@IsEnum(LogLevelType, {
		each: true,
		message: '[{"field":"log_levels","reason":"Each log level must be one of the predefined values."}]',
	})
	log_levels?: LogLevelType[];

	@ApiPropertyOptional({
		description: 'Sets the current house mode.',
		enum: HouseMode,
		example: HouseMode.HOME,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsEnum(HouseMode, {
		message: '[{"field":"house_mode","reason":"House mode must be a valid value (home, away, night)."}]',
	})
	house_mode?: HouseMode;
}
