import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

import { LanguageEnum, TemperatureUnitEnum, TimeFormatEnum, WeatherLocationTypeEnum } from '../config.constants';

export abstract class BaseConfigEntity {}

export class AudioConfigEntity extends BaseConfigEntity {
	@Expose()
	@IsBoolean()
	speaker: boolean = false;

	@Expose({ name: 'speaker_volume' })
	@IsNumber()
	@Min(0)
	@Max(100)
	speakerVolume: number = 0;

	@Expose()
	@IsBoolean()
	microphone: boolean = false;

	@Expose({ name: 'microphone_volume' })
	@IsNumber()
	@Min(0)
	@Max(100)
	microphoneVolume: number = 0;
}

export class DisplayConfigEntity extends BaseConfigEntity {
	@Expose({ name: 'dark_mode' })
	@IsBoolean()
	darkMode: boolean = false;

	@Expose()
	@IsNumber()
	@Min(0)
	@Max(100)
	brightness: number = 0;

	@Expose({ name: 'screen_lock_duration' })
	@IsNumber()
	@Min(0)
	@Max(3600)
	screenLockDuration: number = 30;

	@Expose({ name: 'screen_saver' })
	@IsBoolean()
	screenSaver: boolean = true;
}

export class LanguageConfigEntity extends BaseConfigEntity {
	@Expose()
	@IsEnum(LanguageEnum)
	language: LanguageEnum = LanguageEnum.ENGLISH;

	@Expose()
	@IsString()
	timezone: string = 'Europe/Prague';

	@Expose({ name: 'time_format' })
	@IsEnum(TimeFormatEnum)
	timeFormat: TimeFormatEnum = TimeFormatEnum.HOUR_24;
}

export class WeatherConfigEntity extends BaseConfigEntity {
	@Expose()
	@IsOptional()
	@IsString()
	location: string | null = null;

	@Expose({ name: 'location_type' })
	@IsOptional()
	@IsEnum(WeatherLocationTypeEnum)
	locationType: WeatherLocationTypeEnum = WeatherLocationTypeEnum.CITY_NAME;

	@Expose()
	@IsEnum(TemperatureUnitEnum)
	unit: TemperatureUnitEnum = TemperatureUnitEnum.CELSIUS;

	@Expose({ name: 'open_weather_api_key' })
	@IsOptional()
	@IsString()
	openWeatherApiKey: string | null = null;
}

export class AppConfigEntity {
	@Expose()
	@ValidateNested()
	@Type(() => AudioConfigEntity)
	audio: AudioConfigEntity = new AudioConfigEntity();

	@Expose()
	@ValidateNested()
	@Type(() => DisplayConfigEntity)
	display: DisplayConfigEntity = new DisplayConfigEntity();

	@Expose()
	@ValidateNested()
	@Type(() => LanguageConfigEntity)
	language: LanguageConfigEntity = new LanguageConfigEntity();

	@Expose()
	@ValidateNested()
	@Type(() => WeatherConfigEntity)
	weather: WeatherConfigEntity = new WeatherConfigEntity();
}
