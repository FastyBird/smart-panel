import { Expose, Transform, Type } from 'class-transformer';
import { IsArray, IsDate, IsInt, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'WeatherModuleDataWind' })
export class WindModel {
	@ApiProperty({ description: 'Wind speed (m/s)', type: 'number', example: 3.5 })
	@Expose()
	@IsNumber()
	speed: number;

	@ApiProperty({ description: 'Wind direction (degrees)', type: 'number', example: 250 })
	@Expose()
	@IsNumber()
	deg: number;

	@ApiPropertyOptional({ description: 'Wind gust (m/s)', type: 'number', example: 5.2, nullable: true })
	@Expose()
	@IsOptional()
	@IsNumber()
	gust?: number | null = null;
}

@ApiSchema({ name: 'WeatherModuleDataWeather' })
export class WeatherModel {
	@ApiProperty({ description: 'Weather condition code', type: 'integer', example: 800 })
	@Expose()
	@IsInt()
	code: number;

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

@ApiSchema({ name: 'WeatherModuleDataForecastTemperature' })
export class ForecastTemperatureModel {
	@ApiPropertyOptional({ description: 'Day temperature', type: 'number', example: 15.5, nullable: true })
	@Expose()
	@IsOptional()
	@IsNumber()
	day?: number | null = null;

	@ApiPropertyOptional({ description: 'Minimum temperature', type: 'number', example: 13.5, nullable: true })
	@Expose()
	@IsOptional()
	@IsNumber()
	min?: number | null = null;

	@ApiPropertyOptional({ description: 'Maximum temperature', type: 'number', example: 17.2, nullable: true })
	@Expose()
	@IsOptional()
	@IsNumber()
	max?: number | null = null;

	@ApiPropertyOptional({ description: 'Night temperature', type: 'number', example: 12.0, nullable: true })
	@Expose()
	@IsOptional()
	@IsNumber()
	night?: number | null = null;

	@ApiPropertyOptional({ description: 'Evening temperature', type: 'number', example: 14.5, nullable: true })
	@Expose()
	@IsOptional()
	@IsNumber()
	eve?: number | null = null;

	@ApiPropertyOptional({ description: 'Morning temperature', type: 'number', example: 11.5, nullable: true })
	@Expose()
	@IsOptional()
	@IsNumber()
	morn?: number | null = null;
}

@ApiSchema({ name: 'WeatherModuleDataForecastFeelsLike' })
export class ForecastFeelsLikeModel {
	@ApiPropertyOptional({ description: 'Day feels like temperature', type: 'number', example: 14.2, nullable: true })
	@Expose()
	@IsOptional()
	@IsNumber()
	day?: number | null = null;

	@ApiPropertyOptional({ description: 'Night feels like temperature', type: 'number', example: 11.0, nullable: true })
	@Expose()
	@IsOptional()
	@IsNumber()
	night?: number | null = null;

	@ApiPropertyOptional({ description: 'Evening feels like temperature', type: 'number', example: 13.5, nullable: true })
	@Expose()
	@IsOptional()
	@IsNumber()
	eve?: number | null = null;

	@ApiPropertyOptional({ description: 'Morning feels like temperature', type: 'number', example: 10.5, nullable: true })
	@Expose()
	@IsOptional()
	@IsNumber()
	morn?: number | null = null;
}

@ApiSchema({ name: 'WeatherModuleDataForecastDay' })
export class ForecastDayModel {
	@ApiProperty({ description: 'Temperature information', type: ForecastTemperatureModel })
	@Expose()
	@ValidateNested()
	@Type(() => ForecastTemperatureModel)
	temperature: ForecastTemperatureModel;

	@ApiProperty({ name: 'feels_like', description: 'Feels like temperature information', type: ForecastFeelsLikeModel })
	@Expose({ name: 'feels_like' })
	@ValidateNested()
	@Type(() => ForecastFeelsLikeModel)
	feelsLike: ForecastFeelsLikeModel;

	@ApiProperty({ description: 'Atmospheric pressure (hPa)', type: 'number', example: 1013 })
	@Expose()
	@IsNumber()
	pressure: number;

	@ApiProperty({ description: 'Humidity percentage', type: 'number', example: 72 })
	@Expose()
	@IsNumber()
	humidity: number;

	@ApiProperty({ description: 'Weather condition', type: WeatherModel })
	@Expose()
	@ValidateNested()
	@Type(() => WeatherModel)
	weather: WeatherModel;

	@ApiProperty({ description: 'Wind information', type: WindModel })
	@Expose()
	@ValidateNested()
	@Type(() => WindModel)
	wind: WindModel;

	@ApiProperty({ description: 'Cloudiness percentage', type: 'number', example: 75 })
	@Expose()
	@IsNumber()
	clouds: number;

	@ApiPropertyOptional({ description: 'Rain volume (mm)', type: 'number', example: 2.5, nullable: true })
	@Expose()
	@IsOptional()
	@IsNumber()
	rain: number | null = null;

	@ApiPropertyOptional({ description: 'Snow volume (mm)', type: 'number', example: 1.5, nullable: true })
	@Expose()
	@IsOptional()
	@IsNumber()
	snow: number | null = null;

	@ApiPropertyOptional({
		description: 'Sunrise time (ISO 8601)',
		type: 'string',
		format: 'date-time',
		example: '2020-11-12T07:15:00.000Z',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsDate()
	@Transform(
		({ obj }: { obj: { sunrise: string | Date | undefined } }) => {
			const value: string | Date | undefined = obj.sunrise;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(
		({ value }: { value: string | Date | undefined }) => (value instanceof Date ? value.toISOString() : value),
		{
			toPlainOnly: true,
		},
	)
	sunrise?: Date | null = null;

	@ApiPropertyOptional({
		description: 'Sunset time (ISO 8601)',
		type: 'string',
		format: 'date-time',
		example: '2020-11-12T16:30:00.000Z',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsDate()
	@Transform(
		({ obj }: { obj: { sunset: string | Date | undefined } }) => {
			const value: string | Date | undefined = obj.sunset;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(
		({ value }: { value: string | Date | undefined }) => (value instanceof Date ? value.toISOString() : value),
		{
			toPlainOnly: true,
		},
	)
	sunset?: Date | null = null;

	@ApiPropertyOptional({
		description: 'Moonrise time (ISO 8601)',
		type: 'string',
		format: 'date-time',
		example: '2020-11-12T19:00:00.000Z',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsDate()
	@Transform(
		({ obj }: { obj: { moonrise: string | Date | undefined } }) => {
			const value: string | Date | undefined = obj.moonrise;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(
		({ value }: { value: string | Date | undefined }) => (value instanceof Date ? value.toISOString() : value),
		{
			toPlainOnly: true,
		},
	)
	moonrise?: Date | null = null;

	@ApiPropertyOptional({
		description: 'Moonset time (ISO 8601)',
		type: 'string',
		format: 'date-time',
		example: '2020-11-12T08:00:00.000Z',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsDate()
	@Transform(
		({ obj }: { obj: { moonset: string | Date | undefined } }) => {
			const value: string | Date | undefined = obj.moonset;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(
		({ value }: { value: string | Date | undefined }) => (value instanceof Date ? value.toISOString() : value),
		{
			toPlainOnly: true,
		},
	)
	moonset?: Date | null = null;

	@ApiProperty({
		name: 'day_time',
		description: 'Day time (ISO 8601)',
		type: 'string',
		format: 'date-time',
		example: '2020-11-12T12:00:00.000Z',
	})
	@Expose({ name: 'day_time' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { day_time?: string | Date; dayTime?: string | Date } }) => {
			const value: string | Date = obj.day_time || obj.dayTime;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: string | Date }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	dayTime: Date;
}

@ApiSchema({ name: 'WeatherModuleDataCurrentDay' })
export class CurrentDayModel {
	@ApiProperty({ description: 'Current temperature', type: 'number', example: 15.5 })
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
			obj.temperature_min || obj.temperatureMin,
		{ toClassOnly: true },
	)
	temperatureMin?: number | null = null;

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
			obj.temperature_max || obj.temperatureMax,
		{ toClassOnly: true },
	)
	temperatureMax?: number | null = null;

	@ApiProperty({ name: 'feels_like', description: 'Feels like temperature', type: 'number', example: 14.2 })
	@Expose({ name: 'feels_like' })
	@IsNumber()
	@Transform(({ obj }: { obj: { feels_like?: number; feelsLike?: number } }) => obj.feels_like || obj.feelsLike, {
		toClassOnly: true,
	})
	feelsLike: number;

	@ApiProperty({ description: 'Atmospheric pressure (hPa)', type: 'number', example: 1013 })
	@Expose()
	@IsNumber()
	pressure: number;

	@ApiProperty({ description: 'Humidity percentage', type: 'number', example: 72 })
	@Expose()
	@IsNumber()
	humidity: number;

	@ApiProperty({ description: 'Weather condition', type: WeatherModel })
	@Expose()
	@ValidateNested()
	@Type(() => WeatherModel)
	weather: WeatherModel;

	@ApiProperty({ description: 'Wind information', type: WindModel })
	@Expose()
	@ValidateNested()
	@Type(() => WindModel)
	wind: WindModel;

	@ApiProperty({ description: 'Cloudiness percentage', type: 'number', example: 75 })
	@Expose()
	@IsNumber()
	clouds: number;

	@ApiPropertyOptional({ description: 'Rain volume (mm)', type: 'number', example: 2.5, nullable: true })
	@Expose()
	@IsOptional()
	@IsNumber()
	rain: number | null = null;

	@ApiPropertyOptional({ description: 'Snow volume (mm)', type: 'number', example: 1.5, nullable: true })
	@Expose()
	@IsOptional()
	@IsNumber()
	snow: number | null = null;

	@ApiProperty({
		description: 'Sunrise time (ISO 8601)',
		type: 'string',
		format: 'date-time',
		example: '2020-11-12T07:15:00.000Z',
	})
	@Expose()
	@IsDate()
	@Transform(
		({ obj }: { obj: { sunrise: string | Date } }) => {
			const value: string | Date = obj.sunrise;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: string | Date }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	sunrise: Date;

	@ApiProperty({
		description: 'Sunset time (ISO 8601)',
		type: 'string',
		format: 'date-time',
		example: '2020-11-12T16:30:00.000Z',
	})
	@Expose()
	@IsDate()
	@Transform(
		({ obj }: { obj: { sunset: string | Date } }) => {
			const value: string | Date = obj.sunset;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: string | Date }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	sunset: Date;

	@ApiProperty({
		name: 'day_time',
		description: 'Day time (ISO 8601)',
		type: 'string',
		format: 'date-time',
		example: '2020-11-12T12:00:00.000Z',
	})
	@Expose({ name: 'day_time' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { day_time?: string | Date; dayTime?: string | Date } }) => {
			const value: string | Date = obj.day_time || obj.dayTime;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: string | Date }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	dayTime: Date;
}

@ApiSchema({ name: 'WeatherModuleDataLocation' })
export class LocationModel {
	@ApiProperty({ description: 'Location name', type: 'string', example: 'London' })
	@Expose()
	@IsString()
	name: string;

	@ApiPropertyOptional({ description: 'Country code', type: 'string', example: 'GB', nullable: true })
	@Expose()
	@IsOptional()
	@IsString()
	country?: string | null = null;
}

@ApiSchema({ name: 'WeatherModuleDataLocationWeather' })
export class LocationWeatherModel {
	@ApiPropertyOptional({
		name: 'location_id',
		description: 'Location ID from database',
		type: 'string',
		format: 'uuid',
		nullable: true,
	})
	@Expose({ name: 'location_id' })
	@IsOptional()
	@IsString()
	@Transform(({ obj }: { obj: { location_id?: string; locationId?: string } }) => obj.location_id ?? obj.locationId, {
		toClassOnly: true,
	})
	locationId?: string | null = null;

	@ApiProperty({ description: 'Current weather', type: CurrentDayModel })
	@Expose()
	@ValidateNested()
	@Type(() => CurrentDayModel)
	current: CurrentDayModel;

	@ApiProperty({ description: 'Forecast weather', type: [ForecastDayModel] })
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ForecastDayModel)
	forecast: ForecastDayModel[];

	@ApiProperty({ description: 'Location information', type: LocationModel })
	@Expose()
	@ValidateNested()
	@Type(() => LocationModel)
	location: LocationModel;
}
