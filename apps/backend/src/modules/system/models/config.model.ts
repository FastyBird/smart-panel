import { Expose } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEnum, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
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

	@ApiProperty({
		name: 'temperature_unit',
		description: 'Temperature display unit',
		enum: TemperatureUnitType,
		example: TemperatureUnitType.CELSIUS,
	})
	@Expose({ name: 'temperature_unit' })
	@IsEnum(TemperatureUnitType)
	temperatureUnit: TemperatureUnitType = TemperatureUnitType.CELSIUS;

	@ApiProperty({
		name: 'wind_speed_unit',
		description: 'Wind speed display unit',
		enum: WindSpeedUnitType,
		example: WindSpeedUnitType.METERS_PER_SECOND,
	})
	@Expose({ name: 'wind_speed_unit' })
	@IsEnum(WindSpeedUnitType)
	windSpeedUnit: WindSpeedUnitType = WindSpeedUnitType.METERS_PER_SECOND;

	@ApiProperty({
		name: 'pressure_unit',
		description: 'Pressure display unit',
		enum: PressureUnitType,
		example: PressureUnitType.HECTOPASCAL,
	})
	@Expose({ name: 'pressure_unit' })
	@IsEnum(PressureUnitType)
	pressureUnit: PressureUnitType = PressureUnitType.HECTOPASCAL;

	@ApiProperty({
		name: 'precipitation_unit',
		description: 'Precipitation display unit',
		enum: PrecipitationUnitType,
		example: PrecipitationUnitType.MILLIMETERS,
	})
	@Expose({ name: 'precipitation_unit' })
	@IsEnum(PrecipitationUnitType)
	precipitationUnit: PrecipitationUnitType = PrecipitationUnitType.MILLIMETERS;

	@ApiProperty({
		name: 'distance_unit',
		description: 'Distance display unit',
		enum: DistanceUnitType,
		example: DistanceUnitType.KILOMETERS,
	})
	@Expose({ name: 'distance_unit' })
	@IsEnum(DistanceUnitType)
	distanceUnit: DistanceUnitType = DistanceUnitType.KILOMETERS;

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

	@ApiProperty({
		name: 'house_mode',
		description: 'Current house mode (home, away, night)',
		enum: HouseMode,
		example: HouseMode.HOME,
	})
	@Expose({ name: 'house_mode' })
	@IsEnum(HouseMode)
	houseMode: HouseMode = HouseMode.HOME;
}
