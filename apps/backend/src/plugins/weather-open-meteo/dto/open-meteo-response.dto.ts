import { Expose, Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class OpenMeteoCurrentDto {
	@Expose()
	@IsString()
	time: string;

	@Expose()
	@IsNumber()
	temperature_2m: number;

	@Expose()
	@IsNumber()
	apparent_temperature: number;

	@Expose()
	@IsNumber()
	relative_humidity_2m: number;

	@Expose()
	@IsNumber()
	surface_pressure: number;

	@Expose()
	@IsNumber()
	wind_speed_10m: number;

	@Expose()
	@IsNumber()
	wind_direction_10m: number;

	@Expose()
	@IsOptional()
	@IsNumber()
	wind_gusts_10m?: number;

	@Expose()
	@IsNumber()
	cloud_cover: number;

	@Expose()
	@IsOptional()
	@IsNumber()
	rain?: number;

	@Expose()
	@IsOptional()
	@IsNumber()
	snowfall?: number;

	@Expose()
	@IsNumber()
	weather_code: number;

	@Expose()
	@IsNumber()
	is_day: number;
}

export class OpenMeteoDailyDto {
	@Expose()
	@IsArray()
	@IsString({ each: true })
	time: string[];

	@Expose()
	@IsArray()
	@IsNumber({}, { each: true })
	weather_code: number[];

	@Expose()
	@IsArray()
	@IsNumber({}, { each: true })
	temperature_2m_max: number[];

	@Expose()
	@IsArray()
	@IsNumber({}, { each: true })
	temperature_2m_min: number[];

	@Expose()
	@IsArray()
	@IsNumber({}, { each: true })
	apparent_temperature_max: number[];

	@Expose()
	@IsArray()
	@IsNumber({}, { each: true })
	apparent_temperature_min: number[];

	@Expose()
	@IsArray()
	@IsString({ each: true })
	sunrise: string[];

	@Expose()
	@IsArray()
	@IsString({ each: true })
	sunset: string[];

	@Expose()
	@IsOptional()
	@IsArray()
	@IsNumber({}, { each: true })
	rain_sum?: number[];

	@Expose()
	@IsOptional()
	@IsArray()
	@IsNumber({}, { each: true })
	snowfall_sum?: number[];

	@Expose()
	@IsArray()
	@IsNumber({}, { each: true })
	wind_speed_10m_max: number[];

	@Expose()
	@IsArray()
	@IsNumber({}, { each: true })
	wind_direction_10m_dominant: number[];

	@Expose()
	@IsOptional()
	@IsArray()
	@IsNumber({}, { each: true })
	wind_gusts_10m_max?: number[];

	@Expose()
	@IsArray()
	@IsNumber({}, { each: true })
	pressure_msl_max: number[];

	@Expose()
	@IsArray()
	@IsNumber({}, { each: true })
	relative_humidity_2m_mean: number[];

	@Expose()
	@IsArray()
	@IsNumber({}, { each: true })
	cloud_cover_mean: number[];
}

export class OpenMeteoResponseDto {
	@Expose()
	@IsNumber()
	latitude: number;

	@Expose()
	@IsNumber()
	longitude: number;

	@Expose()
	@IsOptional()
	@IsString()
	timezone?: string;

	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => OpenMeteoCurrentDto)
	current?: OpenMeteoCurrentDto;

	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => OpenMeteoDailyDto)
	daily?: OpenMeteoDailyDto;
}
