import { Expose, Transform } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from '../../config/dto/config.dto';
import {
	DistanceUnitType,
	HouseMode,
	LanguageType,
	LogLevelType,
	PrecipitationUnitType,
	PressureUnitType,
	TemperatureUnitType,
	TimeFormatType,
	WindSpeedUnitType,
} from '../system.constants';
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

	@ApiPropertyOptional({
		description: 'Sets the wind speed display unit.',
		enum: WindSpeedUnitType,
		example: WindSpeedUnitType.METERS_PER_SECOND,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsEnum(WindSpeedUnitType, {
		message: '[{"field":"wind_speed_unit","reason":"Wind speed unit must be ms, kmh, mph or knots."}]',
	})
	wind_speed_unit?: WindSpeedUnitType;

	@ApiPropertyOptional({
		description: 'Sets the pressure display unit.',
		enum: PressureUnitType,
		example: PressureUnitType.HECTOPASCAL,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsEnum(PressureUnitType, {
		message: '[{"field":"pressure_unit","reason":"Pressure unit must be hpa, mbar, inhg or mmhg."}]',
	})
	pressure_unit?: PressureUnitType;

	@ApiPropertyOptional({
		description: 'Sets the precipitation display unit.',
		enum: PrecipitationUnitType,
		example: PrecipitationUnitType.MILLIMETERS,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsEnum(PrecipitationUnitType, {
		message: '[{"field":"precipitation_unit","reason":"Precipitation unit must be mm or inches."}]',
	})
	precipitation_unit?: PrecipitationUnitType;

	@ApiPropertyOptional({
		description: 'Sets the distance display unit.',
		enum: DistanceUnitType,
		example: DistanceUnitType.KILOMETERS,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsEnum(DistanceUnitType, {
		message: '[{"field":"distance_unit","reason":"Distance unit must be km, miles, meters or feet."}]',
	})
	distance_unit?: DistanceUnitType;

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
