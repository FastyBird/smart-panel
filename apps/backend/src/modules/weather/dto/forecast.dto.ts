import { Expose, Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'WeatherModuleCityCoordinates' })
export class CityCoordinatesDto {
	@ApiProperty({ description: 'Latitude', type: 'number', example: 51.5074 })
	@Expose()
	@IsNumber()
	lat: number;

	@ApiProperty({ description: 'Longitude', type: 'number', example: -0.1278 })
	@Expose()
	@IsNumber()
	lon: number;
}

@ApiSchema({ name: 'WeatherModuleForecastMain' })
export class ForecastMainDto {
	@ApiProperty({ description: 'Temperature', type: 'number', example: 15.5 })
	@Expose()
	@IsNumber()
	temp: number;

	@ApiProperty({ name: 'feels_like', description: 'Feels like temperature', type: 'number', example: 14.2 })
	@Expose()
	@IsNumber()
	feels_like: number;

	@ApiProperty({ name: 'temp_min', description: 'Minimum temperature', type: 'number', example: 13.5 })
	@Expose()
	@IsNumber()
	temp_min: number;

	@ApiProperty({ name: 'temp_max', description: 'Maximum temperature', type: 'number', example: 17.2 })
	@Expose()
	@IsNumber()
	temp_max: number;

	@ApiProperty({ description: 'Atmospheric pressure (hPa)', type: 'integer', example: 1013 })
	@Expose()
	@IsInt()
	pressure: number;

	@ApiProperty({ name: 'sea_level', description: 'Sea level pressure (hPa)', type: 'integer', example: 1013 })
	@Expose()
	@IsInt()
	sea_level: number;

	@ApiProperty({ name: 'grnd_level', description: 'Ground level pressure (hPa)', type: 'integer', example: 1009 })
	@Expose()
	@IsInt()
	grnd_level: number;

	@ApiProperty({ description: 'Humidity percentage', type: 'integer', example: 72 })
	@Expose()
	@IsInt()
	humidity: number;

	@ApiProperty({ name: 'temp_kf', description: 'Temperature internal parameter', type: 'number', example: 0 })
	@Expose()
	@IsNumber()
	temp_kf: number;
}

@ApiSchema({ name: 'WeatherModuleForecastCondition' })
export class ForecastConditionDto {
	@ApiProperty({ description: 'Weather condition ID', type: 'integer', example: 800 })
	@Expose()
	@IsInt()
	id: number;

	@ApiProperty({ description: 'Weather group', type: 'string', example: 'Clear' })
	@Expose()
	@IsString()
	main: string;

	@ApiProperty({ description: 'Weather description', type: 'string', example: 'clear sky' })
	@Expose()
	@IsString()
	description: string;

	@ApiProperty({ description: 'Weather icon ID', type: 'string', example: '01d' })
	@Expose()
	@IsString()
	icon: string;
}

@ApiSchema({ name: 'WeatherModuleForecastClouds' })
export class ForecastCloudsDto {
	@ApiProperty({ description: 'Cloudiness percentage', type: 'integer', example: 75 })
	@Expose()
	@IsInt()
	all: number;
}

@ApiSchema({ name: 'WeatherModuleForecastWind' })
export class ForecastWindDto {
	@ApiProperty({ description: 'Wind speed (m/s)', type: 'number', example: 3.5 })
	@Expose()
	@IsNumber()
	speed: number;

	@ApiProperty({ description: 'Wind direction (degrees)', type: 'integer', example: 250 })
	@Expose()
	@IsInt()
	deg: number;

	@ApiProperty({ description: 'Wind gust (m/s)', type: 'number', example: 5.2 })
	@Expose()
	@IsNumber()
	gust: number;
}

@ApiSchema({ name: 'WeatherModuleForecastRain' })
export class ForecastRainDto {
	@ApiProperty({ description: 'Rain volume for last 3 hours (mm)', type: 'number', example: 2.5 })
	@Expose()
	@IsNumber()
	'3h': number;
}

@ApiSchema({ name: 'WeatherModuleForecastSnow' })
export class ForecastSnowDto {
	@ApiProperty({ description: 'Snow volume for last 3 hours (mm)', type: 'number', example: 1.5 })
	@Expose()
	@IsNumber()
	'3h': number;
}

@ApiSchema({ name: 'WeatherModuleForecastSys' })
export class ForecastSysDto {
	@ApiProperty({ description: 'Part of the day (n - night, d - day)', type: 'string', example: 'd' })
	@Expose()
	@IsString()
	pod: string;
}

@ApiSchema({ name: 'WeatherModuleForecastListItem' })
export class ForecastListItemDto {
	@ApiProperty({ description: 'Time of data forecasted (unix timestamp)', type: 'integer', example: 1605182400 })
	@Expose()
	@IsInt()
	dt: number;

	@ApiProperty({ description: 'Main weather parameters', type: ForecastMainDto })
	@Expose()
	@ValidateNested()
	@Type(() => ForecastMainDto)
	main: ForecastMainDto;

	@ApiProperty({ description: 'Weather conditions', type: [ForecastConditionDto] })
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ForecastConditionDto)
	weather: ForecastConditionDto[];

	@ApiProperty({ description: 'Clouds information', type: ForecastCloudsDto })
	@Expose()
	@ValidateNested()
	@Type(() => ForecastCloudsDto)
	clouds: ForecastCloudsDto;

	@ApiProperty({ description: 'Wind information', type: ForecastWindDto })
	@Expose()
	@ValidateNested()
	@Type(() => ForecastWindDto)
	wind: ForecastWindDto;

	@ApiPropertyOptional({ description: 'Visibility (meters)', type: 'integer', example: 10000 })
	@Expose()
	@IsOptional()
	@IsInt()
	visibility?: number;

	@ApiProperty({ description: 'Probability of precipitation', type: 'number', example: 0.25 })
	@Expose()
	@IsNumber()
	pop: number;

	@ApiPropertyOptional({ description: 'Rain information', type: ForecastRainDto })
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => ForecastRainDto)
	rain?: ForecastRainDto;

	@ApiPropertyOptional({ description: 'Snow information', type: ForecastSnowDto })
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => ForecastSnowDto)
	snow?: ForecastSnowDto;

	@ApiProperty({ description: 'System information', type: ForecastSysDto })
	@Expose()
	@ValidateNested()
	@Type(() => ForecastSysDto)
	sys: ForecastSysDto;

	@ApiProperty({
		name: 'dt_txt',
		description: 'Time of data forecasted (text)',
		type: 'string',
		example: '2020-11-12 15:00:00',
	})
	@Expose()
	@IsString()
	dt_txt: string;
}

@ApiSchema({ name: 'WeatherModuleForecastCity' })
export class ForecastCityDto {
	@ApiProperty({ description: 'City ID', type: 'integer', example: 2643743 })
	@Expose()
	@IsInt()
	id: number;

	@ApiProperty({ description: 'City name', type: 'string', example: 'London' })
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({ description: 'City coordinates', type: CityCoordinatesDto })
	@Expose()
	@IsObject()
	@ValidateNested()
	@Type(() => CityCoordinatesDto)
	coord: CityCoordinatesDto;

	@ApiProperty({ description: 'Country code', type: 'string', example: 'GB' })
	@Expose()
	@IsString()
	country: string;

	@ApiProperty({ description: 'City population', type: 'integer', example: 1000000 })
	@Expose()
	@IsInt()
	population: number;

	@ApiProperty({ description: 'Timezone shift from UTC (seconds)', type: 'integer', example: 0 })
	@Expose()
	@IsInt()
	timezone: number;

	@ApiProperty({ description: 'Sunrise time (unix timestamp)', type: 'integer', example: 1605080645 })
	@Expose()
	@IsInt()
	sunrise: number;

	@ApiProperty({ description: 'Sunset time (unix timestamp)', type: 'integer', example: 1605112535 })
	@Expose()
	@IsInt()
	sunset: number;
}

@ApiSchema({ name: 'WeatherModuleForecast' })
export class ForecastDto {
	@ApiProperty({ description: 'Internal parameter', type: 'string', example: '200' })
	@Expose()
	@IsString()
	cod: string;

	@ApiProperty({ description: 'Internal parameter', type: 'integer', example: 0 })
	@Expose()
	@IsInt()
	message: number;

	@ApiProperty({ description: 'Number of forecast items', type: 'integer', example: 40 })
	@Expose()
	@IsInt()
	cnt: number;

	@ApiProperty({ description: 'List of forecast items', type: [ForecastListItemDto] })
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ForecastListItemDto)
	list: ForecastListItemDto[];

	@ApiProperty({ description: 'City information', type: ForecastCityDto })
	@Expose()
	@ValidateNested()
	@Type(() => ForecastCityDto)
	city: ForecastCityDto;
}
