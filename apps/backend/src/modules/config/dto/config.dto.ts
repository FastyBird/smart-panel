import { Expose } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

import type { components } from '../../../openapi';
import { LanguageEnum, TemperatureUnitEnum, TimeFormatEnum, WeatherLocationTypeEnum } from '../config.constants';

export class BaseConfigDto {}

type UpdateAudio = components['schemas']['ConfigUpdateAudio'];
type UpdateDisplay = components['schemas']['ConfigUpdateDisplay'];
type UpdateLanguage = components['schemas']['ConfigUpdateLanguage'];
type UpdateWeather = components['schemas']['ConfigUpdateWeather'];

export class UpdateAudioConfigDto extends BaseConfigDto implements UpdateAudio {
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
	@IsOptional()
	@IsEnum(LanguageEnum, { message: '[{"field":"language","reason":"Language must be a valid string."}]' })
	language?: LanguageEnum;

	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"timezone","reason":"Timezone must be a valid string."}]' })
	timezone?: string;

	@Expose()
	@IsOptional()
	@IsEnum(TimeFormatEnum, { message: '[{"field":"time_format","reason":"Time format must be a valid string."}]' })
	time_format?: TimeFormatEnum;
}

export class UpdateWeatherConfigDto extends BaseConfigDto implements UpdateWeather {
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"location","reason":"Location must be a valid string."}]' })
	location?: string;

	@Expose()
	@IsOptional()
	@IsEnum(WeatherLocationTypeEnum, {
		message: '[{"field":"location_type","reason":"Location type must be a valid location type."}]',
	})
	location_type?: WeatherLocationTypeEnum;

	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ message: '[{"field":"location_lon","reason":"Location longitude must be a valid string."}]' },
	)
	location_lon?: string;

	@Expose()
	@IsEnum(TemperatureUnitEnum, { message: '[{"field":"unit","reason":"Unit must be a valid string."}]' })
	unit?: TemperatureUnitEnum;

	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"open_weather_api_key","reason":"OpenWeather API key must be a valid string."}]' })
	open_weather_api_key?: string;
}
