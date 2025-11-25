import { Expose, Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'WeatherModuleCoordinates' })
class WeatherCoordinatesDto {
	@ApiProperty({ description: 'Longitude', type: 'number', example: -0.1278 })
	@Expose()
	@IsNumber()
	lon: number;

	@ApiProperty({ description: 'Latitude', type: 'number', example: 51.5074 })
	@Expose()
	@IsNumber()
	lat: number;
}

@ApiSchema({ name: 'WeatherModuleCondition' })
class WeatherConditionDto {
	@ApiProperty({ description: 'Weather condition ID', type: 'number', example: 800 })
	@Expose()
	@IsNumber()
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

@ApiSchema({ name: 'WeatherModuleMain' })
class WeatherMainDto {
	@ApiProperty({ description: 'Temperature', type: 'number', example: 15.5 })
	@Expose()
	@IsNumber()
	temp: number;

	@ApiProperty({ name: 'feels_like', description: 'Feels like temperature', type: 'number', example: 14.2 })
	@Expose()
	@IsNumber()
	feels_like: number;

	@ApiProperty({ description: 'Atmospheric pressure (hPa)', type: 'number', example: 1013 })
	@Expose()
	@IsNumber()
	pressure: number;

	@ApiProperty({ description: 'Humidity percentage', type: 'number', example: 72 })
	@Expose()
	@IsNumber()
	humidity: number;

	@ApiProperty({ name: 'temp_min', description: 'Minimum temperature', type: 'number', example: 13.5 })
	@Expose()
	@IsNumber()
	temp_min: number;

	@ApiProperty({ name: 'temp_max', description: 'Maximum temperature', type: 'number', example: 17.2 })
	@Expose()
	@IsNumber()
	temp_max: number;

	@ApiPropertyOptional({ name: 'sea_level', description: 'Sea level pressure (hPa)', type: 'number', example: 1013 })
	@Expose()
	@IsOptional()
	@IsNumber()
	sea_level?: number;

	@ApiPropertyOptional({
		name: 'grnd_level',
		description: 'Ground level pressure (hPa)',
		type: 'number',
		example: 1009,
	})
	@Expose()
	@IsOptional()
	@IsNumber()
	grnd_level?: number;
}

@ApiSchema({ name: 'WeatherModuleWind' })
class WeatherWindDto {
	@ApiProperty({ description: 'Wind speed (m/s)', type: 'number', example: 3.5 })
	@Expose()
	@IsNumber()
	speed: number;

	@ApiProperty({ description: 'Wind direction (degrees)', type: 'number', example: 250 })
	@Expose()
	@IsNumber()
	deg: number;

	@ApiPropertyOptional({ description: 'Wind gust (m/s)', type: 'number', example: 5.2 })
	@Expose()
	@IsOptional()
	@IsNumber()
	gust?: number;
}

@ApiSchema({ name: 'WeatherModuleClouds' })
class WeatherCloudsDto {
	@ApiProperty({ description: 'Cloudiness percentage', type: 'number', example: 75 })
	@Expose()
	@IsNumber()
	all: number;
}

@ApiSchema({ name: 'WeatherModuleRain' })
class WeatherRainDto {
	@ApiProperty({ description: 'Rain volume for last hour (mm)', type: 'number', example: 2.5 })
	@Expose()
	@IsNumber()
	'1h': number;
}

@ApiSchema({ name: 'WeatherModuleSnow' })
class WeatherSnowDto {
	@ApiProperty({ description: 'Snow volume for last hour (mm)', type: 'number', example: 1.5 })
	@Expose()
	@IsNumber()
	'1h': number;
}

@ApiSchema({ name: 'WeatherModuleSys' })
class WeatherSysDto {
	@ApiProperty({ description: 'System type', type: 'number', example: 1 })
	@Expose()
	@IsNumber()
	type: number;

	@ApiProperty({ description: 'System ID', type: 'number', example: 2019 })
	@Expose()
	@IsNumber()
	id: number;

	@ApiProperty({ description: 'Country code', type: 'string', example: 'GB' })
	@Expose()
	@IsString()
	country: string;

	@ApiProperty({ description: 'Sunrise time (unix timestamp)', type: 'integer', example: 1605080645 })
	@Expose()
	@IsInt()
	sunrise: number;

	@ApiProperty({ description: 'Sunset time (unix timestamp)', type: 'integer', example: 1605112535 })
	@Expose()
	@IsInt()
	sunset: number;
}

@ApiSchema({ name: 'WeatherModuleWeather' })
export class WeatherDto {
	@ApiProperty({ description: 'Coordinates', type: WeatherCoordinatesDto })
	@Expose()
	@ValidateNested()
	@Type(() => WeatherCoordinatesDto)
	coord: WeatherCoordinatesDto;

	@ApiProperty({ description: 'Weather conditions', type: [WeatherConditionDto] })
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => WeatherConditionDto)
	weather: WeatherConditionDto[];

	@ApiProperty({ description: 'Internal parameter', type: 'string', example: 'stations' })
	@Expose()
	@IsString()
	base: string;

	@ApiProperty({ description: 'Main weather parameters', type: WeatherMainDto })
	@Expose()
	@ValidateNested()
	@Type(() => WeatherMainDto)
	main: WeatherMainDto;

	@ApiProperty({ description: 'Visibility (meters)', type: 'number', example: 10000 })
	@Expose()
	@IsNumber()
	visibility: number;

	@ApiProperty({ description: 'Wind information', type: WeatherWindDto })
	@Expose()
	@ValidateNested()
	@Type(() => WeatherWindDto)
	wind: WeatherWindDto;

	@ApiProperty({ description: 'Clouds information', type: WeatherCloudsDto })
	@Expose()
	@ValidateNested()
	@Type(() => WeatherCloudsDto)
	clouds: WeatherCloudsDto;

	@ApiPropertyOptional({ description: 'Rain information', type: WeatherRainDto })
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => WeatherRainDto)
	rain?: WeatherRainDto;

	@ApiPropertyOptional({ description: 'Snow information', type: WeatherSnowDto })
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => WeatherSnowDto)
	snow?: WeatherSnowDto;

	@ApiProperty({ description: 'Data calculation time (unix timestamp)', type: 'integer', example: 1605182400 })
	@Expose()
	@IsInt()
	dt: number;

	@ApiProperty({ description: 'System information', type: WeatherSysDto })
	@Expose()
	@ValidateNested()
	@Type(() => WeatherSysDto)
	sys: WeatherSysDto;

	@ApiProperty({ description: 'Timezone shift from UTC (seconds)', type: 'number', example: 0 })
	@Expose()
	@IsNumber()
	timezone: number;

	@ApiProperty({ description: 'City ID', type: 'number', example: 2643743 })
	@Expose()
	@IsNumber()
	id: number;

	@ApiProperty({ description: 'City name', type: 'string', example: 'London' })
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({ description: 'Internal parameter', type: 'number', example: 200 })
	@Expose()
	@IsNumber()
	cod: number;
}
