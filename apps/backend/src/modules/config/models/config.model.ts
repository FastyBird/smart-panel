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

@ApiSchema({ name: 'ConfigModuleDataAudio' })
export class AudioConfigModel extends BaseConfigModel {
	@ApiProperty({
		description: 'Configuration section type',
		enum: [SectionType.AUDIO],
		example: 'audio',
	})
	@Expose()
	@IsOptional()
	type = SectionType.AUDIO;

	@ApiProperty({
		description: 'Speaker enabled state',
		type: 'boolean',
		example: false,
	})
	@Expose()
	@IsBoolean()
	speaker: boolean = false;

	@ApiProperty({
		name: 'speaker_volume',
		description: 'Speaker volume level (0-100)',
		type: 'integer',
		format: 'int32',
		minimum: 0,
		maximum: 100,
		example: 0,
	})
	@Expose({ name: 'speaker_volume' })
	@IsNumber()
	@Min(0)
	@Max(100)
	speakerVolume: number = 0;

	@ApiProperty({
		description: 'Microphone enabled state',
		type: 'boolean',
		example: false,
	})
	@Expose()
	@IsBoolean()
	microphone: boolean = false;

	@ApiProperty({
		name: 'microphone_volume',
		description: 'Microphone volume level (0-100)',
		type: 'integer',
		format: 'int32',
		minimum: 0,
		maximum: 100,
		example: 0,
	})
	@Expose({ name: 'microphone_volume' })
	@IsNumber()
	@Min(0)
	@Max(100)
	microphoneVolume: number = 0;
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

@ApiSchema({ name: 'ConfigModuleDataWeather' })
export abstract class WeatherConfigModel extends BaseConfigModel {
	@ApiProperty({
		description: 'Configuration section type',
		enum: [SectionType.WEATHER],
		example: 'weather',
	})
	@Expose()
	@IsOptional()
	type = SectionType.WEATHER;

	@Expose({ name: 'location_type' })
	@IsEnum(WeatherLocationType)
	locationType: WeatherLocationType = WeatherLocationType.CITY_NAME;

	@ApiProperty({
		description: 'Temperature unit preference',
		enum: TemperatureUnitType,
		example: TemperatureUnitType.CELSIUS,
	})
	@Expose()
	@IsEnum(TemperatureUnitType)
	unit: TemperatureUnitType = TemperatureUnitType.CELSIUS;

	@ApiProperty({
		name: 'open_weather_api_key',
		description: 'OpenWeatherMap API key',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'open_weather_api_key' })
	@IsOptional()
	@IsString()
	openWeatherApiKey: string | null = null;
}

@ApiSchema({ name: 'ConfigModuleDataWeatherLatLon' })
export class WeatherLatLonConfigModel extends WeatherConfigModel {
	@ApiProperty({
		name: 'location_type',
		description: 'Type of location data',
		enum: [WeatherLocationType.LAT_LON],
		example: 'lat_lon',
	})
	@Expose({ name: 'location_type' })
	@IsOptional()
	locationType: WeatherLocationType.LAT_LON = WeatherLocationType.LAT_LON;

	@ApiProperty({
		description: 'Latitude coordinate (-90 to 90)',
		type: 'number',
		format: 'float',
		minimum: -90,
		maximum: 90,
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@IsNumber()
	@Min(-90)
	@Max(90)
	latitude: number | null = null;

	@ApiProperty({
		description: 'Longitude coordinate (-180 to 180)',
		type: 'number',
		format: 'float',
		minimum: -180,
		maximum: 180,
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@IsNumber()
	@Min(-180)
	@Max(180)
	longitude: number | null = null;
}

@ApiSchema({ name: 'ConfigModuleDataWeatherCityName' })
export class WeatherCityNameConfigModel extends WeatherConfigModel {
	@ApiProperty({
		name: 'location_type',
		description: 'Type of location data',
		enum: [WeatherLocationType.CITY_NAME],
		example: 'city_name',
	})
	@Expose({ name: 'location_type' })
	@IsOptional()
	locationType: WeatherLocationType.CITY_NAME = WeatherLocationType.CITY_NAME;

	@ApiProperty({
		name: 'city_name',
		description: 'City name with optional country code',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'city_name' })
	@IsOptional()
	@IsString()
	cityName: string | null = null;

	@ApiProperty({
		description: 'Latitude coordinate (-90 to 90)',
		type: 'number',
		format: 'float',
		minimum: -90,
		maximum: 90,
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@IsNumber()
	@Min(-90)
	@Max(90)
	latitude: number | null = null;

	@ApiProperty({
		description: 'Longitude coordinate (-180 to 180)',
		type: 'number',
		format: 'float',
		minimum: -180,
		maximum: 180,
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@IsNumber()
	@Min(-180)
	@Max(180)
	longitude: number | null = null;
}

@ApiSchema({ name: 'ConfigModuleDataWeatherCityId' })
export class WeatherCityIdConfigModel extends WeatherConfigModel {
	@ApiProperty({
		name: 'location_type',
		description: 'Type of location data',
		enum: [WeatherLocationType.CITY_ID],
		example: 'city_id',
	})
	@Expose({ name: 'location_type' })
	@IsOptional()
	locationType: WeatherLocationType.CITY_ID = WeatherLocationType.CITY_ID;

	@ApiProperty({
		name: 'city_id',
		description: 'OpenWeatherMap city ID',
		type: 'integer',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'city_id' })
	@IsOptional()
	@IsInt()
	cityId: number | null = null;
}

@ApiSchema({ name: 'ConfigModuleDataWeatherZipCode' })
export class WeatherZipCodeConfigModel extends WeatherConfigModel {
	@ApiProperty({
		name: 'location_type',
		description: 'Type of location data',
		enum: [WeatherLocationType.ZIP_CODE],
		example: 'zip_code',
	})
	@Expose({ name: 'location_type' })
	@IsOptional()
	locationType: WeatherLocationType.ZIP_CODE = WeatherLocationType.ZIP_CODE;

	@ApiProperty({
		name: 'zip_code',
		description: 'ZIP/postal code with optional country code',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'zip_code' })
	@IsOptional()
	@IsString()
	zipCode: string | null = null;

	@ApiProperty({
		description: 'Latitude coordinate (-90 to 90)',
		type: 'number',
		format: 'float',
		minimum: -90,
		maximum: 90,
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@IsNumber()
	@Min(-90)
	@Max(90)
	latitude: number | null = null;

	@ApiProperty({
		description: 'Longitude coordinate (-180 to 180)',
		type: 'number',
		format: 'float',
		minimum: -180,
		maximum: 180,
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@IsNumber()
	@Min(-180)
	@Max(180)
	longitude: number | null = null;
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
		description: 'Audio configuration section',
		type: () => AudioConfigModel,
	})
	@Expose()
	@ValidateNested()
	@Type(() => AudioConfigModel)
	audio: AudioConfigModel = new AudioConfigModel();

	@ApiProperty({
		description: 'Language configuration section',
		type: () => LanguageConfigModel,
	})
	@Expose()
	@ValidateNested()
	@Type(() => LanguageConfigModel)
	language: LanguageConfigModel = new LanguageConfigModel();

	@ApiProperty({
		description: 'Weather configuration section',
		oneOf: [
			{ $ref: getSchemaPath(WeatherLatLonConfigModel) },
			{ $ref: getSchemaPath(WeatherCityNameConfigModel) },
			{ $ref: getSchemaPath(WeatherCityIdConfigModel) },
			{ $ref: getSchemaPath(WeatherZipCodeConfigModel) },
		],
		discriminator: {
			propertyName: 'location_type',
			mapping: {
				lat_lon: getSchemaPath(WeatherLatLonConfigModel),
				city_name: getSchemaPath(WeatherCityNameConfigModel),
				city_id: getSchemaPath(WeatherCityIdConfigModel),
				zip_code: getSchemaPath(WeatherZipCodeConfigModel),
			},
		},
	})
	@Expose()
	@ValidateNested()
	@Type(() => WeatherConfigModel, {
		discriminator: {
			property: 'location_type',
			subTypes: [
				{ value: WeatherLatLonConfigModel, name: WeatherLocationType.LAT_LON },
				{ value: WeatherCityNameConfigModel, name: WeatherLocationType.CITY_NAME },
				{ value: WeatherCityIdConfigModel, name: WeatherLocationType.CITY_ID },
				{ value: WeatherZipCodeConfigModel, name: WeatherLocationType.ZIP_CODE },
			],
		},
		keepDiscriminatorProperty: true,
	})
	weather:
		| WeatherLatLonConfigModel
		| WeatherCityNameConfigModel
		| WeatherCityIdConfigModel
		| WeatherZipCodeConfigModel = new WeatherCityNameConfigModel();

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
	@Type(() => PluginConfigModel)
	plugins: PluginConfigModel[] = [];
}
