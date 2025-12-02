import { Expose, Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

export class CityCoordinatesDto {
	@Expose()
	@IsNumber()
	lat: number;

	@Expose()
	@IsNumber()
	lon: number;
}

export class ForecastMainDto {
	@Expose()
	@IsNumber()
	temp: number;

	@Expose()
	@IsNumber()
	feels_like: number;

	@Expose()
	@IsNumber()
	temp_min: number;

	@Expose()
	@IsNumber()
	temp_max: number;

	@Expose()
	@IsInt()
	pressure: number;

	@Expose()
	@IsInt()
	sea_level: number;

	@Expose()
	@IsInt()
	grnd_level: number;

	@Expose()
	@IsInt()
	humidity: number;

	@Expose()
	@IsNumber()
	temp_kf: number;
}

export class ForecastConditionDto {
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

export class ForecastCloudsDto {
	@Expose()
	@IsInt()
	all: number;
}

export class ForecastWindDto {
	@Expose()
	@IsNumber()
	speed: number;

	@Expose()
	@IsInt()
	deg: number;

	@Expose()
	@IsNumber()
	gust: number;
}

export class ForecastRainDto {
	@Expose()
	@IsNumber()
	'3h': number;
}

export class ForecastSnowDto {
	@Expose()
	@IsNumber()
	'3h': number;
}

export class ForecastSysDto {
	@Expose()
	@IsString()
	pod: string;
}

export class ForecastListItemDto {
	@Expose()
	@IsInt()
	dt: number;

	@Expose()
	@ValidateNested()
	@Type(() => ForecastMainDto)
	main: ForecastMainDto;

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ForecastConditionDto)
	weather: ForecastConditionDto[];

	@Expose()
	@ValidateNested()
	@Type(() => ForecastCloudsDto)
	clouds: ForecastCloudsDto;

	@Expose()
	@ValidateNested()
	@Type(() => ForecastWindDto)
	wind: ForecastWindDto;

	@Expose()
	@IsOptional()
	@IsInt()
	visibility?: number;

	@Expose()
	@IsNumber()
	pop: number;

	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => ForecastRainDto)
	rain?: ForecastRainDto;

	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => ForecastSnowDto)
	snow?: ForecastSnowDto;

	@Expose()
	@ValidateNested()
	@Type(() => ForecastSysDto)
	sys: ForecastSysDto;

	@Expose()
	@IsString()
	dt_txt: string;
}

export class ForecastCityDto {
	@Expose()
	@IsInt()
	id: number;

	@Expose()
	@IsString()
	name: string;

	@Expose()
	@IsObject()
	@ValidateNested()
	@Type(() => CityCoordinatesDto)
	coord: CityCoordinatesDto;

	@Expose()
	@IsString()
	country: string;

	@Expose()
	@IsInt()
	population: number;

	@Expose()
	@IsInt()
	timezone: number;

	@Expose()
	@IsInt()
	sunrise: number;

	@Expose()
	@IsInt()
	sunset: number;
}

export class ForecastDto {
	@Expose()
	@IsString()
	cod: string;

	@Expose()
	@IsInt()
	message: number;

	@Expose()
	@IsInt()
	cnt: number;

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ForecastListItemDto)
	list: ForecastListItemDto[];

	@Expose()
	@ValidateNested()
	@Type(() => ForecastCityDto)
	city: ForecastCityDto;
}
