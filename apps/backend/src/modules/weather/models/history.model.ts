import { Expose, Transform, Type } from 'class-transformer';
import { IsArray, IsDate, IsInt, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

/**
 * Historical weather data point
 */
@ApiSchema({ name: 'WeatherModuleDataHistoryPoint' })
export class WeatherHistoryPointModel {
	@ApiProperty({
		description: 'Timestamp of the data point (ISO 8601)',
		type: 'string',
		format: 'date-time',
		example: '2024-01-15T12:00:00.000Z',
	})
	@Expose()
	@IsDate()
	@Transform(
		({ obj }: { obj: { time: string | Date } }) => {
			const value = obj.time;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: Date }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	time: Date;

	@ApiProperty({
		name: 'location_id',
		description: 'Location ID',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'location_id' })
	@IsString()
	@Transform(({ obj }: { obj: { location_id?: string; locationId?: string } }) => obj.location_id ?? obj.locationId, {
		toClassOnly: true,
	})
	locationId: string;

	@ApiProperty({
		name: 'location_name',
		description: 'Location name',
		type: 'string',
		example: 'Home',
	})
	@Expose({ name: 'location_name' })
	@IsString()
	@Transform(
		({ obj }: { obj: { location_name?: string; locationName?: string } }) => obj.location_name ?? obj.locationName,
		{
			toClassOnly: true,
		},
	)
	locationName: string;

	@ApiProperty({
		description: 'Temperature',
		type: 'number',
		example: 15.5,
	})
	@Expose()
	@IsNumber()
	temperature: number;

	@ApiPropertyOptional({
		name: 'temperature_min',
		description: 'Minimum temperature',
		type: 'number',
		example: 13.5,
		nullable: true,
	})
	@Expose({ name: 'temperature_min' })
	@IsOptional()
	@IsNumber()
	@Transform(
		({ obj }: { obj: { temperature_min?: number; temperatureMin?: number } }) =>
			obj.temperature_min ?? obj.temperatureMin,
		{
			toClassOnly: true,
		},
	)
	temperatureMin?: number | null;

	@ApiPropertyOptional({
		name: 'temperature_max',
		description: 'Maximum temperature',
		type: 'number',
		example: 17.2,
		nullable: true,
	})
	@Expose({ name: 'temperature_max' })
	@IsOptional()
	@IsNumber()
	@Transform(
		({ obj }: { obj: { temperature_max?: number; temperatureMax?: number } }) =>
			obj.temperature_max ?? obj.temperatureMax,
		{
			toClassOnly: true,
		},
	)
	temperatureMax?: number | null;

	@ApiProperty({
		name: 'feels_like',
		description: 'Feels like temperature',
		type: 'number',
		example: 14.2,
	})
	@Expose({ name: 'feels_like' })
	@IsNumber()
	@Transform(({ obj }: { obj: { feels_like?: number; feelsLike?: number } }) => obj.feels_like ?? obj.feelsLike, {
		toClassOnly: true,
	})
	feelsLike: number;

	@ApiProperty({
		description: 'Atmospheric pressure (hPa)',
		type: 'number',
		example: 1013,
	})
	@Expose()
	@IsNumber()
	pressure: number;

	@ApiProperty({
		description: 'Humidity percentage',
		type: 'number',
		example: 72,
	})
	@Expose()
	@IsNumber()
	humidity: number;

	@ApiProperty({
		description: 'Cloudiness percentage',
		type: 'number',
		example: 75,
	})
	@Expose()
	@IsNumber()
	clouds: number;

	@ApiProperty({
		name: 'wind_speed',
		description: 'Wind speed (m/s)',
		type: 'number',
		example: 3.5,
	})
	@Expose({ name: 'wind_speed' })
	@IsNumber()
	@Transform(({ obj }: { obj: { wind_speed?: number; windSpeed?: number } }) => obj.wind_speed ?? obj.windSpeed, {
		toClassOnly: true,
	})
	windSpeed: number;

	@ApiProperty({
		name: 'wind_deg',
		description: 'Wind direction (degrees)',
		type: 'number',
		example: 250,
	})
	@Expose({ name: 'wind_deg' })
	@IsNumber()
	@Transform(({ obj }: { obj: { wind_deg?: number; windDeg?: number } }) => obj.wind_deg ?? obj.windDeg, {
		toClassOnly: true,
	})
	windDeg: number;

	@ApiPropertyOptional({
		name: 'wind_gust',
		description: 'Wind gust (m/s)',
		type: 'number',
		example: 5.2,
		nullable: true,
	})
	@Expose({ name: 'wind_gust' })
	@IsOptional()
	@IsNumber()
	@Transform(({ obj }: { obj: { wind_gust?: number; windGust?: number } }) => obj.wind_gust ?? obj.windGust, {
		toClassOnly: true,
	})
	windGust?: number | null;

	@ApiPropertyOptional({
		description: 'Rain volume (mm)',
		type: 'number',
		example: 2.5,
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsNumber()
	rain?: number | null;

	@ApiPropertyOptional({
		description: 'Snow volume (mm)',
		type: 'number',
		example: 1.5,
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsNumber()
	snow?: number | null;

	@ApiProperty({
		name: 'weather_code',
		description: 'Weather condition code',
		type: 'integer',
		example: 800,
	})
	@Expose({ name: 'weather_code' })
	@IsInt()
	@Transform(({ obj }: { obj: { weather_code?: number; weatherCode?: number } }) => obj.weather_code ?? obj.weatherCode, {
		toClassOnly: true,
	})
	weatherCode: number;

	@ApiProperty({
		name: 'weather_main',
		description: 'Weather group',
		type: 'string',
		example: 'Clear',
	})
	@Expose({ name: 'weather_main' })
	@IsString()
	@Transform(({ obj }: { obj: { weather_main?: string; weatherMain?: string } }) => obj.weather_main ?? obj.weatherMain, {
		toClassOnly: true,
	})
	weatherMain: string;
}

/**
 * Weather statistics model
 */
@ApiSchema({ name: 'WeatherModuleDataStatistics' })
export class WeatherStatisticsModel {
	@ApiPropertyOptional({
		name: 'avg_temperature',
		description: 'Average temperature',
		type: 'number',
		example: 15.5,
		nullable: true,
	})
	@Expose({ name: 'avg_temperature' })
	@IsOptional()
	@IsNumber()
	@Transform(
		({ obj }: { obj: { avg_temperature?: number; avgTemperature?: number } }) =>
			obj.avg_temperature ?? obj.avgTemperature,
		{
			toClassOnly: true,
		},
	)
	avgTemperature?: number | null;

	@ApiPropertyOptional({
		name: 'min_temperature',
		description: 'Minimum temperature',
		type: 'number',
		example: 10.2,
		nullable: true,
	})
	@Expose({ name: 'min_temperature' })
	@IsOptional()
	@IsNumber()
	@Transform(
		({ obj }: { obj: { min_temperature?: number; minTemperature?: number } }) =>
			obj.min_temperature ?? obj.minTemperature,
		{
			toClassOnly: true,
		},
	)
	minTemperature?: number | null;

	@ApiPropertyOptional({
		name: 'max_temperature',
		description: 'Maximum temperature',
		type: 'number',
		example: 22.8,
		nullable: true,
	})
	@Expose({ name: 'max_temperature' })
	@IsOptional()
	@IsNumber()
	@Transform(
		({ obj }: { obj: { max_temperature?: number; maxTemperature?: number } }) =>
			obj.max_temperature ?? obj.maxTemperature,
		{
			toClassOnly: true,
		},
	)
	maxTemperature?: number | null;

	@ApiPropertyOptional({
		name: 'avg_humidity',
		description: 'Average humidity percentage',
		type: 'number',
		example: 65,
		nullable: true,
	})
	@Expose({ name: 'avg_humidity' })
	@IsOptional()
	@IsNumber()
	@Transform(({ obj }: { obj: { avg_humidity?: number; avgHumidity?: number } }) => obj.avg_humidity ?? obj.avgHumidity, {
		toClassOnly: true,
	})
	avgHumidity?: number | null;

	@ApiPropertyOptional({
		name: 'avg_pressure',
		description: 'Average atmospheric pressure (hPa)',
		type: 'number',
		example: 1015,
		nullable: true,
	})
	@Expose({ name: 'avg_pressure' })
	@IsOptional()
	@IsNumber()
	@Transform(({ obj }: { obj: { avg_pressure?: number; avgPressure?: number } }) => obj.avg_pressure ?? obj.avgPressure, {
		toClassOnly: true,
	})
	avgPressure?: number | null;

	@ApiPropertyOptional({
		name: 'total_rain',
		description: 'Total rain volume (mm)',
		type: 'number',
		example: 12.5,
		nullable: true,
	})
	@Expose({ name: 'total_rain' })
	@IsOptional()
	@IsNumber()
	@Transform(({ obj }: { obj: { total_rain?: number; totalRain?: number } }) => obj.total_rain ?? obj.totalRain, {
		toClassOnly: true,
	})
	totalRain?: number | null;

	@ApiPropertyOptional({
		name: 'total_snow',
		description: 'Total snow volume (mm)',
		type: 'number',
		example: 0,
		nullable: true,
	})
	@Expose({ name: 'total_snow' })
	@IsOptional()
	@IsNumber()
	@Transform(({ obj }: { obj: { total_snow?: number; totalSnow?: number } }) => obj.total_snow ?? obj.totalSnow, {
		toClassOnly: true,
	})
	totalSnow?: number | null;
}

/**
 * Response wrapper for weather history
 */
@ApiSchema({ name: 'WeatherModuleResHistory' })
export class WeatherHistoryResponseModel extends BaseSuccessResponseModel<WeatherHistoryPointModel[]> {
	@ApiProperty({
		description: 'Historical weather data points',
		type: 'array',
		items: { $ref: getSchemaPath(WeatherHistoryPointModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => WeatherHistoryPointModel)
	declare data: WeatherHistoryPointModel[];
}

/**
 * Response wrapper for weather statistics
 */
@ApiSchema({ name: 'WeatherModuleResStatistics' })
export class WeatherStatisticsResponseModel extends BaseSuccessResponseModel<WeatherStatisticsModel> {
	@ApiProperty({
		description: 'Weather statistics',
		type: WeatherStatisticsModel,
	})
	@Expose()
	@ValidateNested()
	@Type(() => WeatherStatisticsModel)
	declare data: WeatherStatisticsModel;
}
