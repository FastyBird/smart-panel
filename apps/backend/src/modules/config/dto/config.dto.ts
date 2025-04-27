import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';
import {
	LanguageType,
	SectionType,
	TemperatureUnitType,
	TimeFormatType,
	WeatherLocationTypeType,
} from '../config.constants';

type ReqUpdateSection = components['schemas']['ConfigModuleReqUpdateSection'];
type ReqUpdatePlugin = components['schemas']['ConfigModuleReqUpdatePlugin'];
type UpdateAudio = components['schemas']['ConfigModuleUpdateAudio'];
type UpdateDisplay = components['schemas']['ConfigModuleUpdateDisplay'];
type UpdateLanguage = components['schemas']['ConfigModuleUpdateLanguage'];
type UpdateWeather = components['schemas']['ConfigModuleUpdateWeather'];
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
				return UpdateWeatherConfigDto;
			default:
				throw new Error(`Unknown type ${(obj.data as { type: string }).type}`);
		}
	}
	throw new Error('Invalid object format for determining config DTO');
};

export class BaseConfigDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid section string."}]' })
	type: SectionType.AUDIO | SectionType.DISPLAY | SectionType.LANGUAGE | SectionType.WEATHER;
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

export class UpdateWeatherConfigDto extends BaseConfigDto implements UpdateWeather {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a weather string."}]' })
	type: SectionType.WEATHER;

	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"location","reason":"Location must be a valid string."}]' })
	location?: string;

	@Expose()
	@IsOptional()
	@IsEnum(WeatherLocationTypeType, {
		message: '[{"field":"location_type","reason":"Location type must be a valid location type."}]',
	})
	location_type?: WeatherLocationTypeType;

	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ message: '[{"field":"location_lon","reason":"Location longitude must be a valid string."}]' },
	)
	location_lon?: string;

	@Expose()
	@IsEnum(TemperatureUnitType, { message: '[{"field":"unit","reason":"Unit must be a valid string."}]' })
	unit?: TemperatureUnitType;

	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"open_weather_api_key","reason":"OpenWeather API key must be a valid string."}]' })
	open_weather_api_key?: string;
}

export class ReqUpdateSectionDto implements ReqUpdateSection {
	@Expose()
	@ValidateNested()
	@Type((options) => determineConfigDto(options?.object ?? {}))
	data: UpdateAudioConfigDto | UpdateDisplayConfigDto | UpdateLanguageConfigDto | UpdateWeatherConfigDto;
}

export class UpdatePluginConfigDto implements UpdatePlugin {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string;
}

export class ReqUpdatePluginDto implements ReqUpdatePlugin {
	@Expose()
	@ValidateNested()
	@Type(() => UpdatePluginConfigDto)
	data: UpdatePluginConfigDto;
}
