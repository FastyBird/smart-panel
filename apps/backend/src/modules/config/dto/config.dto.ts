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

export class UpdateAudioConfigDto extends BaseConfigDto implements UpdateAudio {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a audio string."}]' })
	type: SectionType.AUDIO;

	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"speaker","reason":"Speaker must be a boolean value."}]' })
	speaker?: boolean;

	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"speaker_volume","reason":"Speaker volume must be a valid number."}]' },
	)
	@Min(0, { message: '[{"field":"speaker_volume","reason":"Speaker volume must be at least 0."}]' })
	@Max(100, { message: '[{"field":"speaker_volume","reason":"Speaker volume cannot exceed 100."}]' })
	speaker_volume?: number;

	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"microphone","reason":"Microphone must be a boolean value."}]' })
	microphone?: boolean;

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

export class UpdateDisplayConfigDto extends BaseConfigDto implements UpdateDisplay {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a display string."}]' })
	type: SectionType.DISPLAY;

	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"dark_mode","reason":"Dark mode must be a boolean value."}]' })
	dark_mode?: boolean;

	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"brightness","reason":"Brightness must be a valid number."}]' },
	)
	@Min(0, { message: '[{"field":"brightness","reason":"Brightness must be at least 0."}]' })
	@Max(100, { message: '[{"field":"brightness","reason":"Brightness cannot exceed 100."}]' })
	brightness?: number;

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

	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"screen_saver","reason":"Screen saver must be a boolean value."}]' })
	screen_saver?: boolean;
}

export class UpdateLanguageConfigDto extends BaseConfigDto implements UpdateLanguage {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a language string."}]' })
	type: SectionType.LANGUAGE;

	@Expose()
	@IsOptional()
	@IsEnum(LanguageType, { message: '[{"field":"language","reason":"Language must be a valid string."}]' })
	language?: LanguageType;

	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"timezone","reason":"Timezone must be a valid string."}]' })
	timezone?: string;

	@Expose()
	@IsOptional()
	@IsEnum(TimeFormatType, { message: '[{"field":"time_format","reason":"Time format must be a valid string."}]' })
	time_format?: TimeFormatType;
}

export abstract class UpdateWeatherConfigDto extends BaseConfigDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a weather string."}]' })
	type: SectionType.WEATHER;

	@Expose()
	@IsOptional()
	@IsEnum(WeatherLocationType, {
		message: '[{"field":"location_type","reason":"Location type must be a valid location type."}]',
	})
	location_type?: WeatherLocationType;

	@Expose()
	@IsEnum(TemperatureUnitType, { message: '[{"field":"unit","reason":"Unit must be a valid string."}]' })
	unit?: TemperatureUnitType;

	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"open_weather_api_key","reason":"OpenWeather API key must be a valid string."}]' })
	open_weather_api_key?: string;
}

export class UpdateWeatherLatLonConfigDto extends UpdateWeatherConfigDto implements UpdateWeatherLatLon {
	@Expose()
	@IsString({ message: '[{"field":"location_type","reason":"Location type must be a valid location type."}]' })
	location_type: WeatherLocationType.LAT_LON;

	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"latitude","reason":"Latitude must be a valid number."}]' },
	)
	@Min(-90, { message: '[{"field":"latitude","reason":"Latitude must be greater than -90."}]' })
	@Max(90, { message: '[{"field":"latitude","reason":"Latitude must be lower than -90."}]' })
	latitude?: number;

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

export class UpdateWeatherCityNameConfigDto extends UpdateWeatherConfigDto implements UpdateWeatherCityName {
	@Expose()
	@IsString({ message: '[{"field":"location_type","reason":"Location type must be a valid location type."}]' })
	location_type: WeatherLocationType.CITY_NAME;

	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"city_name","reason":"City name must be a valid string."}]' })
	city_name?: string;

	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"latitude","reason":"Latitude must be a valid number."}]' },
	)
	@Min(-90, { message: '[{"field":"latitude","reason":"Latitude must be greater than -90."}]' })
	@Max(90, { message: '[{"field":"latitude","reason":"Latitude must be lower than -90."}]' })
	latitude?: number;

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

export class UpdateWeatherCityIdConfigDto extends UpdateWeatherConfigDto implements UpdateWeatherCityId {
	@Expose()
	@IsString({ message: '[{"field":"location_type","reason":"Location type must be a valid location type."}]' })
	location_type: WeatherLocationType.CITY_ID;

	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"city_id","reason":"City ID must be a valid number."}]' })
	city_id?: number;
}

export class UpdateWeatherZipCodeConfigDto extends UpdateWeatherConfigDto implements UpdateWeatherZipCode {
	@Expose()
	@IsString({ message: '[{"field":"location_type","reason":"Location type must be a valid location type."}]' })
	location_type: WeatherLocationType.ZIP_CODE;

	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"zip_code","reason":"ZIP code must be a valid string."}]' })
	zip_code?: string;

	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"latitude","reason":"Latitude must be a valid number."}]' },
	)
	@Min(-90, { message: '[{"field":"latitude","reason":"Latitude must be greater than -90."}]' })
	@Max(90, { message: '[{"field":"latitude","reason":"Latitude must be lower than -90."}]' })
	latitude?: number;

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

export class UpdateSystemConfigDto extends BaseConfigDto implements UpdateSystem {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a language string."}]' })
	type: SectionType.SYSTEM;

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

export class ReqUpdateSectionDto implements ReqUpdateSection {
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

export class UpdatePluginConfigDto implements UpdatePlugin {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string;

	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled must be a boolean value."}]' })
	enabled?: boolean;
}

export class ReqUpdatePluginDto implements ReqUpdatePlugin {
	@Expose()
	@ValidateNested()
	@Type(() => UpdatePluginConfigDto)
	data: UpdatePluginConfigDto;
}
