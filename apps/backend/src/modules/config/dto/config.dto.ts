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

import { ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';

import { ApiSchema } from '../../../common/decorators/api-schema.decorator';

import type { components } from '../../../openapi';
import {
	LanguageType,
	LogLevelType,
	SectionType,
	TemperatureUnitType,
	TimeFormatType,
	WeatherLocationType,
} from '../config.constants';

type ReqUpdateSection = components['schemas']['ConfigModuleReqUpdateSection'];
type ReqUpdatePlugin = components['schemas']['ConfigModuleReqUpdatePlugin'];
type UpdateAudio = components['schemas']['ConfigModuleUpdateAudio'];
type UpdateDisplay = components['schemas']['ConfigModuleUpdateDisplay'];
type UpdateLanguage = components['schemas']['ConfigModuleUpdateLanguage'];
type UpdateWeatherLatLon = components['schemas']['ConfigModuleUpdateWeatherLatLon'];
type UpdateWeatherCityName = components['schemas']['ConfigModuleUpdateWeatherCityName'];
type UpdateWeatherCityId = components['schemas']['ConfigModuleUpdateWeatherCityId'];
type UpdateWeatherZipCode = components['schemas']['ConfigModuleUpdateWeatherZipCode'];
type UpdateSystem = components['schemas']['ConfigModuleUpdateSystem'];
type UpdatePlugin = components['schemas']['ConfigModuleUpdatePlugin'];

const determineConfigDto = (obj: unknown): new () => object => {
	if (
		typeof obj === 'object' &&
		obj !== null &&
		'data' in obj &&
		typeof obj.data === 'object' &&
		obj.data !== null &&
		'type' in obj.data
	) {
		const type = (obj.data as { type: string }).type as SectionType;

		if (!Object.values(SectionType).includes(type)) {
			throw new Error(`Unknown type ${type}`);
		}

		switch (type) {
			case SectionType.AUDIO:
				return UpdateAudioConfigDto;
			case SectionType.DISPLAY:
				return UpdateDisplayConfigDto;
			case SectionType.LANGUAGE:
				return UpdateLanguageConfigDto;
			case SectionType.WEATHER:
				if ('location_type' in obj.data) {
					const locationType = (obj.data as { location_type: string }).location_type as WeatherLocationType;

					switch (locationType) {
						case WeatherLocationType.LAT_LON:
							return UpdateWeatherLatLonConfigDto;
						case WeatherLocationType.CITY_NAME:
							return UpdateWeatherCityNameConfigDto;
						case WeatherLocationType.CITY_ID:
							return UpdateWeatherCityIdConfigDto;
						case WeatherLocationType.ZIP_CODE:
							return UpdateWeatherZipCodeConfigDto;
						default:
							throw new Error(`Unknown location type ${(obj.data as { location_type: string }).location_type}`);
					}
				}
				throw new Error('Invalid object format for determining config weather DTO');
			case SectionType.SYSTEM:
				return UpdateSystemConfigDto;
			default:
				throw new Error(`Unknown type ${(obj.data as { type: string }).type}`);
		}
	}
	throw new Error('Invalid object format for determining config DTO');
};

export class BaseConfigDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid section string."}]' })
	type: SectionType.AUDIO | SectionType.DISPLAY | SectionType.LANGUAGE | SectionType.WEATHER | SectionType.SYSTEM;
}

@ApiSchema('ConfigModuleUpdateAudio')
export class UpdateAudioConfigDto extends BaseConfigDto implements UpdateAudio {
	@ApiProperty({
		description: 'Configuration section type',
		enum: [SectionType.AUDIO],
		example: 'audio',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a audio string."}]' })
	type: SectionType.AUDIO;

	@ApiPropertyOptional({
		description: 'Enables or disables the speaker.',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"speaker","reason":"Speaker must be a boolean value."}]' })
	speaker?: boolean;

	@ApiPropertyOptional({
		description: 'Sets the speaker volume (0-100).',
		type: 'integer',
		format: 'int32',
		minimum: 0,
		maximum: 100,
		example: 34,
	})
	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"speaker_volume","reason":"Speaker volume must be a valid number."}]' },
	)
	@Min(0, { message: '[{"field":"speaker_volume","reason":"Speaker volume must be at least 0."}]' })
	@Max(100, { message: '[{"field":"speaker_volume","reason":"Speaker volume cannot exceed 100."}]' })
	speaker_volume?: number;

	@ApiPropertyOptional({
		description: 'Enables or disables the microphone.',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"microphone","reason":"Microphone must be a boolean value."}]' })
	microphone?: boolean;

	@ApiPropertyOptional({
		description: 'Sets the microphone volume (0-100).',
		type: 'integer',
		format: 'int32',
		minimum: 0,
		maximum: 100,
		example: 55,
	})
	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"microphone_volume","reason":"Microphone volume must be a valid number."}]' },
	)
	@Min(0, { message: '[{"field":"microphone_volume","reason":"Microphone volume must be at least 0."}]' })
	@Max(100, { message: '[{"field":"microphone_volume","reason":"Microphone volume cannot exceed 100."}]' })
	microphone_volume?: number;
}

@ApiSchema('ConfigModuleUpdateDisplay')
export class UpdateDisplayConfigDto extends BaseConfigDto implements UpdateDisplay {
	@ApiProperty({
		description: 'Configuration section type',
		enum: [SectionType.DISPLAY],
		example: 'display',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a display string."}]' })
	type: SectionType.DISPLAY;

	@ApiPropertyOptional({
		description: 'Enables or disables dark mode.',
		type: 'boolean',
		example: false,
	})
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"dark_mode","reason":"Dark mode must be a boolean value."}]' })
	dark_mode?: boolean;

	@ApiPropertyOptional({
		description: 'Sets the display brightness (0-100).',
		type: 'integer',
		format: 'int32',
		minimum: 0,
		maximum: 100,
		example: 50,
	})
	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"brightness","reason":"Brightness must be a valid number."}]' },
	)
	@Min(0, { message: '[{"field":"brightness","reason":"Brightness must be at least 0."}]' })
	@Max(100, { message: '[{"field":"brightness","reason":"Brightness cannot exceed 100."}]' })
	brightness?: number;

	@ApiPropertyOptional({
		description: 'Sets the screen lock duration in seconds (0-3600).',
		type: 'integer',
		format: 'int32',
		minimum: 0,
		maximum: 3600,
		example: 30,
	})
	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{
			each: false,
			message: '[{"field":"screen_lock_duration","reason":"Screen lock duration must be a valid number."}]',
		},
	)
	@Min(0, { message: '[{"field":"screen_lock_duration","reason":"Screen lock duration must be at least 0."}]' })
	@Max(3600, {
		message: '[{"field":"screen_lock_duration","reason":"Screen lock duration cannot exceed 3600 seconds."}]',
	})
	screen_lock_duration?: number;

	@ApiPropertyOptional({
		description: 'Enables or disables the screen saver.',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"screen_saver","reason":"Screen saver must be a boolean value."}]' })
	screen_saver?: boolean;
}

@ApiSchema('ConfigModuleUpdateLanguage')
export class UpdateLanguageConfigDto extends BaseConfigDto implements UpdateLanguage {
	@ApiProperty({
		description: 'Configuration section type',
		enum: [SectionType.LANGUAGE],
		example: 'language',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a language string."}]' })
	type: SectionType.LANGUAGE;

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
}

@ApiSchema('ConfigModuleUpdateWeather')
export abstract class UpdateWeatherConfigDto extends BaseConfigDto {
	@ApiProperty({
		description: 'Configuration section type',
		enum: [SectionType.WEATHER],
		example: 'weather',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a weather string."}]' })
	type: SectionType.WEATHER;

	@ApiPropertyOptional({
		description: 'Type of location data provided.',
		enum: WeatherLocationType,
		example: WeatherLocationType.CITY_NAME,
	})
	@Expose()
	@IsOptional()
	@IsEnum(WeatherLocationType, {
		message: '[{"field":"location_type","reason":"Location type must be a valid location type."}]',
	})
	location_type?: WeatherLocationType;

	@ApiPropertyOptional({
		description: 'Temperature unit preference.',
		enum: TemperatureUnitType,
		example: TemperatureUnitType.CELSIUS,
	})
	@Expose()
	@IsEnum(TemperatureUnitType, { message: '[{"field":"unit","reason":"Unit must be a valid string."}]' })
	unit?: TemperatureUnitType;

	@ApiPropertyOptional({
		description: 'OpenWeatherMap API key.',
		type: 'string',
		example: 'your-api-key-here',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"open_weather_api_key","reason":"OpenWeather API key must be a valid string."}]' })
	open_weather_api_key?: string;
}

@ApiSchema('ConfigModuleUpdateWeatherLatLon')
export class UpdateWeatherLatLonConfigDto extends UpdateWeatherConfigDto implements UpdateWeatherLatLon {
	@ApiProperty({
		description: 'Location type',
		enum: [WeatherLocationType.LAT_LON],
		example: 'lat_lon',
	})
	@Expose()
	@IsString({ message: '[{"field":"location_type","reason":"Location type must be a valid location type."}]' })
	location_type: WeatherLocationType.LAT_LON;

	@ApiPropertyOptional({
		description: 'Latitude coordinate (-90 to 90).',
		type: 'number',
		format: 'float',
		minimum: -90,
		maximum: 90,
		example: 50.0755,
	})
	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"latitude","reason":"Latitude must be a valid number."}]' },
	)
	@Min(-90, { message: '[{"field":"latitude","reason":"Latitude must be greater than -90."}]' })
	@Max(90, { message: '[{"field":"latitude","reason":"Latitude must be lower than -90."}]' })
	latitude?: number;

	@ApiPropertyOptional({
		description: 'Longitude coordinate (-180 to 180).',
		type: 'number',
		format: 'float',
		minimum: -180,
		maximum: 180,
		example: 14.4378,
	})
	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"longitude","reason":"Longitude must be a valid number."}]' },
	)
	@Min(-180, { message: '[{"field":"longitude","reason":"Longitude must be greater than -180."}]' })
	@Max(180, { message: '[{"field":"longitude","reason":"Longitude must be lower than -180."}]' })
	longitude?: number;
}

@ApiSchema('ConfigModuleUpdateWeatherCityName')
export class UpdateWeatherCityNameConfigDto extends UpdateWeatherConfigDto implements UpdateWeatherCityName {
	@ApiProperty({
		description: 'Location type',
		enum: [WeatherLocationType.CITY_NAME],
		example: 'city_name',
	})
	@Expose()
	@IsString({ message: '[{"field":"location_type","reason":"Location type must be a valid location type."}]' })
	location_type: WeatherLocationType.CITY_NAME;

	@ApiPropertyOptional({
		description: 'City name with optional country code (e.g., "Prague,CZ").',
		type: 'string',
		example: 'Prague,CZ',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"city_name","reason":"City name must be a valid string."}]' })
	city_name?: string;

	@ApiPropertyOptional({
		description: 'Latitude coordinate (-90 to 90).',
		type: 'number',
		format: 'float',
		minimum: -90,
		maximum: 90,
		example: 50.0755,
	})
	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"latitude","reason":"Latitude must be a valid number."}]' },
	)
	@Min(-90, { message: '[{"field":"latitude","reason":"Latitude must be greater than -90."}]' })
	@Max(90, { message: '[{"field":"latitude","reason":"Latitude must be lower than -90."}]' })
	latitude?: number;

	@ApiPropertyOptional({
		description: 'Longitude coordinate (-180 to 180).',
		type: 'number',
		format: 'float',
		minimum: -180,
		maximum: 180,
		example: 14.4378,
	})
	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"longitude","reason":"Longitude must be a valid number."}]' },
	)
	@Min(-180, { message: '[{"field":"longitude","reason":"Longitude must be greater than -180."}]' })
	@Max(180, { message: '[{"field":"longitude","reason":"Longitude must be lower than -180."}]' })
	longitude?: number;
}

@ApiSchema('ConfigModuleUpdateWeatherCityId')
export class UpdateWeatherCityIdConfigDto extends UpdateWeatherConfigDto implements UpdateWeatherCityId {
	@ApiProperty({
		description: 'Location type',
		enum: [WeatherLocationType.CITY_ID],
		example: 'city_id',
	})
	@Expose()
	@IsString({ message: '[{"field":"location_type","reason":"Location type must be a valid location type."}]' })
	location_type: WeatherLocationType.CITY_ID;

	@ApiPropertyOptional({
		description: 'OpenWeatherMap city ID.',
		type: 'integer',
		example: 3067696,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"city_id","reason":"City ID must be a valid number."}]' })
	city_id?: number;
}

@ApiSchema('ConfigModuleUpdateWeatherZipCode')
export class UpdateWeatherZipCodeConfigDto extends UpdateWeatherConfigDto implements UpdateWeatherZipCode {
	@ApiProperty({
		description: 'Location type',
		enum: [WeatherLocationType.ZIP_CODE],
		example: 'zip_code',
	})
	@Expose()
	@IsString({ message: '[{"field":"location_type","reason":"Location type must be a valid location type."}]' })
	location_type: WeatherLocationType.ZIP_CODE;

	@ApiPropertyOptional({
		description: 'ZIP/postal code with optional country code (e.g., "11000,CZ").',
		type: 'string',
		example: '11000,CZ',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"zip_code","reason":"ZIP code must be a valid string."}]' })
	zip_code?: string;

	@ApiPropertyOptional({
		description: 'Latitude coordinate (-90 to 90).',
		type: 'number',
		format: 'float',
		minimum: -90,
		maximum: 90,
		example: 50.0755,
	})
	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"latitude","reason":"Latitude must be a valid number."}]' },
	)
	@Min(-90, { message: '[{"field":"latitude","reason":"Latitude must be greater than -90."}]' })
	@Max(90, { message: '[{"field":"latitude","reason":"Latitude must be lower than -90."}]' })
	latitude?: number;

	@ApiPropertyOptional({
		description: 'Longitude coordinate (-180 to 180).',
		type: 'number',
		format: 'float',
		minimum: -180,
		maximum: 180,
		example: 14.4378,
	})
	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"longitude","reason":"Longitude must be a valid number."}]' },
	)
	@Min(-180, { message: '[{"field":"longitude","reason":"Longitude must be greater than -180."}]' })
	@Max(180, { message: '[{"field":"longitude","reason":"Longitude must be lower than -180."}]' })
	longitude?: number;
}

@ApiSchema('ConfigModuleUpdateSystem')
export class UpdateSystemConfigDto extends BaseConfigDto implements UpdateSystem {
	@ApiProperty({
		description: 'Configuration section type',
		enum: [SectionType.SYSTEM],
		example: 'system',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a language string."}]' })
	type: SectionType.SYSTEM;

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

@ApiSchema('ConfigModuleReqUpdateSection')
export class ReqUpdateSectionDto implements ReqUpdateSection {
	@ApiProperty({
		description: 'Configuration section data',
		oneOf: [
			{ $ref: getSchemaPath(UpdateAudioConfigDto) },
			{ $ref: getSchemaPath(UpdateDisplayConfigDto) },
			{ $ref: getSchemaPath(UpdateLanguageConfigDto) },
			{ $ref: getSchemaPath(UpdateWeatherLatLonConfigDto) },
			{ $ref: getSchemaPath(UpdateWeatherCityNameConfigDto) },
			{ $ref: getSchemaPath(UpdateWeatherCityIdConfigDto) },
			{ $ref: getSchemaPath(UpdateWeatherZipCodeConfigDto) },
			{ $ref: getSchemaPath(UpdateSystemConfigDto) },
		],
		discriminator: {
			propertyName: 'type',
		},
	})
	@Expose()
	@ValidateNested()
	@Type((options) => determineConfigDto(options?.object ?? {}))
	data:
		| UpdateAudioConfigDto
		| UpdateDisplayConfigDto
		| UpdateLanguageConfigDto
		| UpdateWeatherLatLonConfigDto
		| UpdateWeatherCityNameConfigDto
		| UpdateWeatherCityIdConfigDto
		| UpdateWeatherZipCodeConfigDto
		| UpdateSystemConfigDto;
}

@ApiSchema('ConfigModuleUpdatePlugin')
export class UpdatePluginConfigDto implements UpdatePlugin {
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

@ApiSchema('ConfigModuleReqUpdatePlugin')
export class ReqUpdatePluginDto implements ReqUpdatePlugin {
	@ApiProperty({
		description: 'Plugin configuration data',
		type: () => UpdatePluginConfigDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => UpdatePluginConfigDto)
	data: UpdatePluginConfigDto;
}
