import { Expose, Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

class WeatherCoordinatesDto {
	@Expose()
	@IsNumber()
	lon: number;

	@Expose()
	@IsNumber()
	lat: number;
}

class WeatherConditionDto {
	@Expose()
	@IsNumber()
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

class WeatherMainDto {
	@Expose()
	@IsNumber()
	temp: number;

	@Expose()
	@IsNumber()
	feels_like: number;

	@Expose()
	@IsNumber()
	pressure: number;

	@Expose()
	@IsNumber()
	humidity: number;

	@Expose()
	@IsNumber()
	temp_min: number;

	@Expose()
	@IsNumber()
	temp_max: number;

	@Expose()
	@IsOptional()
	@IsNumber()
	sea_level?: number;

	@Expose()
	@IsOptional()
	@IsNumber()
	grnd_level?: number;
}

class WeatherWindDto {
	@Expose()
	@IsNumber()
	speed: number;

	@Expose()
	@IsNumber()
	deg: number;

	@Expose()
	@IsOptional()
	@IsNumber()
	gust?: number;
}

class WeatherCloudsDto {
	@Expose()
	@IsNumber()
	all: number;
}

class WeatherRainDto {
	@Expose()
	@IsNumber()
	'1h': number;
}

class WeatherSnowDto {
	@Expose()
	@IsNumber()
	'1h': number;
}

class WeatherSysDto {
	@Expose()
	@IsNumber()
	type: number;

	@Expose()
	@IsNumber()
	id: number;

	@Expose()
	@IsString()
	country: string;

	@Expose()
	@IsInt()
	sunrise: number;

	@Expose()
	@IsInt()
	sunset: number;
}

export class WeatherDto {
	@Expose()
	@ValidateNested()
	@Type(() => WeatherCoordinatesDto)
	coord: WeatherCoordinatesDto;

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => WeatherConditionDto)
	weather: WeatherConditionDto[];

	@Expose()
	@IsString()
	base: string;

	@Expose()
	@ValidateNested()
	@Type(() => WeatherMainDto)
	main: WeatherMainDto;

	@Expose()
	@IsNumber()
	visibility: number;

	@Expose()
	@ValidateNested()
	@Type(() => WeatherWindDto)
	wind: WeatherWindDto;

	@Expose()
	@ValidateNested()
	@Type(() => WeatherCloudsDto)
	clouds: WeatherCloudsDto;

	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => WeatherRainDto)
	rain?: WeatherRainDto;

	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => WeatherSnowDto)
	snow?: WeatherSnowDto;

	@Expose()
	@IsInt()
	dt: number;

	@Expose()
	@ValidateNested()
	@Type(() => WeatherSysDto)
	sys: WeatherSysDto;

	@Expose()
	@IsNumber()
	timezone: number;

	@Expose()
	@IsNumber()
	id: number;

	@Expose()
	@IsString()
	name: string;

	@Expose()
	@IsNumber()
	cod: number;
}
