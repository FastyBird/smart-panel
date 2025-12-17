import { Expose, Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

class OneCallWeatherConditionDto {
	@Expose()
	@IsInt()
	id: number;

	@Expose()
	@IsString()
	main: string;

	@Expose()
	@IsString()
	description: string;

	@Expose()
	@IsString()
	icon: string;
}

class OneCallRainDto {
	@Expose()
	@IsNumber()
	'1h': number;
}

class OneCallSnowDto {
	@Expose()
	@IsNumber()
	'1h': number;
}

export class OpenWeatherMapOneCallCurrentWeatherDto {
	@Expose()
	@IsInt()
	dt: number;

	@Expose()
	@IsInt()
	sunrise: number;

	@Expose()
	@IsInt()
	sunset: number;

	@Expose()
	@IsNumber()
	temp: number;

	@Expose()
	@IsNumber()
	feels_like: number;

	@Expose()
	@IsInt()
	pressure: number;

	@Expose()
	@IsInt()
	humidity: number;

	@Expose()
	@IsInt()
	clouds: number;

	@Expose()
	@IsNumber()
	wind_speed: number;

	@Expose()
	@IsInt()
	wind_deg: number;

	@Expose()
	@IsOptional()
	@IsNumber()
	wind_gust?: number;

	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => OneCallRainDto)
	rain?: OneCallRainDto;

	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => OneCallSnowDto)
	snow?: OneCallSnowDto;

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => OneCallWeatherConditionDto)
	weather: OneCallWeatherConditionDto[];
}

class OneCallDailyTemperatureDto {
	@Expose()
	@IsNumber()
	day: number;

	@Expose()
	@IsNumber()
	min: number;

	@Expose()
	@IsNumber()
	max: number;

	@Expose()
	@IsNumber()
	night: number;

	@Expose()
	@IsNumber()
	eve: number;

	@Expose()
	@IsNumber()
	morn: number;
}

class OneCallDailyFeelsLikeDto {
	@Expose()
	@IsNumber()
	day: number;

	@Expose()
	@IsNumber()
	night: number;

	@Expose()
	@IsNumber()
	eve: number;

	@Expose()
	@IsNumber()
	morn: number;
}

export class OpenWeatherMapOneCallDailyWeatherDto {
	@Expose()
	@IsInt()
	dt: number;

	@Expose()
	@IsInt()
	sunrise: number;

	@Expose()
	@IsInt()
	sunset: number;

	@Expose()
	@IsInt()
	moonrise: number;

	@Expose()
	@IsInt()
	moonset: number;

	@Expose()
	@ValidateNested()
	@Type(() => OneCallDailyTemperatureDto)
	temp: OneCallDailyTemperatureDto;

	@Expose()
	@ValidateNested()
	@Type(() => OneCallDailyFeelsLikeDto)
	feels_like: OneCallDailyFeelsLikeDto;

	@Expose()
	@IsInt()
	pressure: number;

	@Expose()
	@IsInt()
	humidity: number;

	@Expose()
	@IsInt()
	clouds: number;

	@Expose()
	@IsNumber()
	wind_speed: number;

	@Expose()
	@IsInt()
	wind_deg: number;

	@Expose()
	@IsOptional()
	@IsNumber()
	wind_gust?: number;

	@Expose()
	@IsOptional()
	@IsNumber()
	rain?: number;

	@Expose()
	@IsOptional()
	@IsNumber()
	snow?: number;

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => OneCallWeatherConditionDto)
	weather: OneCallWeatherConditionDto[];
}

export class OpenWeatherMapOneCallAlertDto {
	@Expose()
	@IsString()
	sender_name: string;

	@Expose()
	@IsString()
	event: string;

	@Expose()
	@IsInt()
	start: number;

	@Expose()
	@IsInt()
	end: number;

	@Expose()
	@IsString()
	description: string;

	@Expose()
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	tags?: string[];
}

export class OpenWeatherMapOneCallResponseDto {
	@Expose()
	@IsNumber()
	lat: number;

	@Expose()
	@IsNumber()
	lon: number;

	@Expose()
	@IsString()
	timezone: string;

	@Expose()
	@IsInt()
	timezone_offset: number;

	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => OpenWeatherMapOneCallCurrentWeatherDto)
	current?: OpenWeatherMapOneCallCurrentWeatherDto;

	@Expose()
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => OpenWeatherMapOneCallDailyWeatherDto)
	daily?: OpenWeatherMapOneCallDailyWeatherDto[];

	@Expose()
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => OpenWeatherMapOneCallAlertDto)
	alerts?: OpenWeatherMapOneCallAlertDto[];
}
