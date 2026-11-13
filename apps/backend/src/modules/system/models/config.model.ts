import { Expose } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import {
	DistanceUnitType,
	HouseMode,
	LanguageType,
	LogLevelType,
	NumberFormatType,
	PrecipitationUnitType,
	PressureUnitType,
	TemperatureUnitType,
	TimeFormatType,
	UpdateChannelType,
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

	@ApiProperty({
		description: 'Module enabled state',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	override enabled: boolean = true;

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

	/*
	 * The house location, used by the sun cards of the automations. A configuration written before the
	 * location existed is defaulted from the primary weather location at start (HouseLocationDefaultService).
	 */
	@ApiProperty({
		description:
			'Latitude of the house in degrees, north positive. Used to compute sunrise and sunset locally; null while the house location is not set.',
		type: 'number',
		minimum: -90,
		maximum: 90,
		nullable: true,
		example: 50.0755,
	})
	@Expose()
	@IsOptional()
	@IsNumber()
	@Min(-90)
	@Max(90)
	latitude: number | null = null;

	@ApiProperty({
		description:
			'Longitude of the house in degrees, east positive. Used to compute sunrise and sunset locally; null while the house location is not set.',
		type: 'number',
		minimum: -180,
		maximum: 180,
		nullable: true,
		example: 14.4378,
	})
	@Expose()
	@IsOptional()
	@IsNumber()
	@Min(-180)
	@Max(180)
	longitude: number | null = null;

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
		name: 'number_format',
		description: 'Number format for displaying numeric values',
		enum: NumberFormatType,
		example: NumberFormatType.COMMA_DOT,
	})
	@Expose({ name: 'number_format' })
	@IsEnum(NumberFormatType)
	numberFormat: NumberFormatType = NumberFormatType.COMMA_DOT;

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
		minItems: 1,
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

	@ApiProperty({
		name: 'onboarding_completed',
		description: 'Whether the initial onboarding wizard has been completed',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'onboarding_completed' })
	@IsOptional()
	@IsBoolean()
	onboardingCompleted: boolean = false;

	@ApiProperty({
		name: 'update_channel',
		description:
			'Minimum release stability the update check will offer. "auto" follows the channel of the ' +
			'installed version; any explicit channel also accepts everything more stable than itself.',
		enum: UpdateChannelType,
		example: UpdateChannelType.AUTO,
	})
	@Expose({ name: 'update_channel' })
	@IsEnum(UpdateChannelType)
	updateChannel: UpdateChannelType = UpdateChannelType.AUTO;
}
