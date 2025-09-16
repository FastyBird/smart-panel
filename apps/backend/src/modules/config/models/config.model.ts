import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

import {
	LanguageType,
	SectionType,
	TemperatureUnitType,
	TimeFormatType,
	WeatherLocationType,
} from '../config.constants';

export abstract class BaseConfigModel {
	@Expose()
	type?: SectionType;
}

export class AudioConfigModel extends BaseConfigModel {
	@Expose()
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
	@Expose()
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
	@Expose()
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

export abstract class WeatherConfigModel extends BaseConfigModel {
	@Expose()
	@IsOptional()
	type = SectionType.WEATHER;

	@Expose({ name: 'location_type' })
	@IsEnum(WeatherLocationType)
	locationType: WeatherLocationType = WeatherLocationType.CITY_NAME;

	@Expose()
	@IsEnum(TemperatureUnitType)
	unit: TemperatureUnitType = TemperatureUnitType.CELSIUS;

	@Expose({ name: 'open_weather_api_key' })
	@IsOptional()
	@IsString()
	openWeatherApiKey: string | null = null;
}

export class WeatherLatLonConfigModel extends WeatherConfigModel {
	@Expose({ name: 'location_type' })
	@IsOptional()
	locationType: WeatherLocationType.LAT_LON = WeatherLocationType.LAT_LON;

	@Expose()
	@IsOptional()
	@IsNumber()
	@Min(-90)
	@Max(90)
	latitude: number | null = null;

	@Expose()
	@IsOptional()
	@IsNumber()
	@Min(-180)
	@Max(180)
	longitude: number | null = null;
}

export class WeatherCityNameConfigModel extends WeatherConfigModel {
	@Expose({ name: 'location_type' })
	@IsOptional()
	locationType: WeatherLocationType.CITY_NAME = WeatherLocationType.CITY_NAME;

	@Expose({ name: 'city_name' })
	@IsOptional()
	@IsString()
	cityName: string | null = null;

	@Expose()
	@IsOptional()
	@IsNumber()
	@Min(-90)
	@Max(90)
	latitude: number | null = null;

	@Expose()
	@IsOptional()
	@IsNumber()
	@Min(-180)
	@Max(180)
	longitude: number | null = null;
}

export class WeatherCityIdConfigModel extends WeatherConfigModel {
	@Expose({ name: 'location_type' })
	@IsOptional()
	locationType: WeatherLocationType.CITY_ID = WeatherLocationType.CITY_ID;

	@Expose({ name: 'city_id' })
	@IsOptional()
	@IsInt()
	cityId: number | null = null;
}

export class WeatherZipCodeConfigModel extends WeatherConfigModel {
	@Expose({ name: 'location_type' })
	@IsOptional()
	locationType: WeatherLocationType.ZIP_CODE = WeatherLocationType.ZIP_CODE;

	@Expose({ name: 'zip_code' })
	@IsOptional()
	@IsString()
	zipCode: string | null = null;

	@Expose()
	@IsOptional()
	@IsNumber()
	@Min(-90)
	@Max(90)
	latitude: number | null = null;

	@Expose()
	@IsOptional()
	@IsNumber()
	@Min(-180)
	@Max(180)
	longitude: number | null = null;
}

export abstract class PluginConfigModel {
	@Expose()
	@IsString()
	type: string;

	@Expose()
	@IsBoolean()
	enabled: boolean = false;
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

	@Expose()
	@ValidateNested({ each: true })
	plugins: PluginConfigModel[] = [];
}
