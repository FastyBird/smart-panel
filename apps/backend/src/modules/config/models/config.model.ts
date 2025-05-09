import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

import {
	LanguageType,
	SectionType,
	TemperatureUnitType,
	TimeFormatType,
	WeatherLocationTypeType,
} from '../config.constants';

export abstract class BaseConfigModel {
	@Expose({ groups: ['api'] })
	type?: SectionType;
}

export class AudioConfigModel extends BaseConfigModel {
	@Expose({ groups: ['api'] })
	@IsOptional()
	type = SectionType.AUDIO;

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

export class DisplayConfigModel extends BaseConfigModel {
	@Expose({ groups: ['api'] })
	@IsOptional()
	type = SectionType.DISPLAY;

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

export class LanguageConfigModel extends BaseConfigModel {
	@Expose({ groups: ['api'] })
	@IsOptional()
	type = SectionType.LANGUAGE;

	@Expose()
	@IsEnum(LanguageType)
	language: LanguageType = LanguageType.ENGLISH;

	@Expose()
	@IsString()
	timezone: string = 'Europe/Prague';

	@Expose({ name: 'time_format' })
	@IsEnum(TimeFormatType)
	timeFormat: TimeFormatType = TimeFormatType.HOUR_24;
}

export class WeatherConfigModel extends BaseConfigModel {
	@Expose({ groups: ['api'] })
	@IsOptional()
	type = SectionType.WEATHER;

	@Expose()
	@IsOptional()
	@IsString()
	location: string | null = null;

	@Expose({ name: 'location_type' })
	@IsOptional()
	@IsEnum(WeatherLocationTypeType)
	locationType: WeatherLocationTypeType = WeatherLocationTypeType.CITY_NAME;

	@Expose()
	@IsEnum(TemperatureUnitType)
	unit: TemperatureUnitType = TemperatureUnitType.CELSIUS;

	@Expose({ name: 'open_weather_api_key' })
	@IsOptional()
	@IsString()
	openWeatherApiKey: string | null = null;
}

export abstract class PluginConfigModel {
	@Expose({ groups: ['api'] })
	@IsString()
	type: string;
}

export class AppConfigModel {
	@Expose()
	@ValidateNested()
	@Type(() => AudioConfigModel)
	audio: AudioConfigModel = new AudioConfigModel();

	@Expose()
	@ValidateNested()
	@Type(() => DisplayConfigModel)
	display: DisplayConfigModel = new DisplayConfigModel();

	@Expose()
	@ValidateNested()
	@Type(() => LanguageConfigModel)
	language: LanguageConfigModel = new LanguageConfigModel();

	@Expose()
	@ValidateNested()
	@Type(() => WeatherConfigModel)
	weather: WeatherConfigModel = new WeatherConfigModel();

	@Expose()
	@ValidateNested({ each: true })
	plugins: PluginConfigModel[] = [];
}
