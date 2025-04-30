import { Expose, Transform, Type } from 'class-transformer';
import { IsArray, IsDate, IsInt, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class WindEntity {
	@Expose()
	@IsNumber()
	speed: number;

	@Expose()
	@IsNumber()
	deg: number;

	@Expose()
	@IsOptional()
	@IsNumber()
	gust?: number = null;
}

export class WeatherEntity {
	@Expose()
	@IsInt()
	code: number;

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

export class ForecastTemperatureEntity {
	@Expose()
	@IsOptional()
	@IsNumber()
	day?: number = null;

	@Expose()
	@IsOptional()
	@IsNumber()
	min?: number = null;

	@Expose()
	@IsOptional()
	@IsNumber()
	max?: number = null;

	@Expose()
	@IsOptional()
	@IsNumber()
	night?: number = null;

	@Expose()
	@IsOptional()
	@IsNumber()
	eve?: number = null;

	@Expose()
	@IsOptional()
	@IsNumber()
	morn?: number = null;
}

export class ForecastFeelsLikeEntity {
	@Expose()
	@IsOptional()
	@IsNumber()
	day?: number = null;

	@Expose()
	@IsOptional()
	@IsNumber()
	night?: number = null;

	@Expose()
	@IsOptional()
	@IsNumber()
	eve?: number = null;

	@Expose()
	@IsOptional()
	@IsNumber()
	morn?: number = null;
}

export class ForecastDayEntity {
	@Expose()
	@ValidateNested()
	@Type(() => ForecastTemperatureEntity)
	temperature: ForecastTemperatureEntity;

	@Expose({ name: 'feels_like' })
	@ValidateNested()
	@Type(() => ForecastFeelsLikeEntity)
	feelsLike: ForecastFeelsLikeEntity;

	@Expose()
	@IsNumber()
	pressure: number;

	@Expose()
	@IsNumber()
	humidity: number;

	@Expose()
	@ValidateNested()
	@Type(() => WeatherEntity)
	weather: WeatherEntity;

	@Expose()
	@ValidateNested()
	@Type(() => WindEntity)
	wind: WindEntity;

	@Expose()
	@IsNumber()
	clouds: number;

	@Expose()
	@IsOptional()
	@IsNumber()
	rain: number | null = null;

	@Expose()
	@IsOptional()
	@IsNumber()
	snow: number | null = null;

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
	sunrise?: Date = null;

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
	sunset?: Date = null;

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
	moonrise?: Date = null;

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
	moonset?: Date = null;

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

export class CurrentDayEntity {
	@Expose()
	@IsNumber()
	temperature: number;

	@Expose({ name: 'temperature_min' })
	@IsOptional()
	@IsNumber()
	@Transform(
		({ obj }: { obj: { temperature_min?: number; temperatureMin?: number } }) =>
			obj.temperature_min || obj.temperatureMin,
		{ toClassOnly: true },
	)
	temperatureMin?: number = null;

	@Expose({ name: 'temperature_max' })
	@IsOptional()
	@IsNumber()
	@Transform(
		({ obj }: { obj: { temperature_max?: number; temperatureMax?: number } }) =>
			obj.temperature_max || obj.temperatureMax,
		{ toClassOnly: true },
	)
	temperatureMax?: number = null;

	@Expose({ name: 'feels_like' })
	@IsNumber()
	@Transform(({ obj }: { obj: { feels_like?: number; feelsLike?: number } }) => obj.feels_like || obj.feelsLike, {
		toClassOnly: true,
	})
	feelsLike: number;

	@Expose()
	@IsNumber()
	pressure: number;

	@Expose()
	@IsNumber()
	humidity: number;

	@Expose()
	@ValidateNested()
	@Type(() => WeatherEntity)
	weather: WeatherEntity;

	@Expose()
	@ValidateNested()
	@Type(() => WindEntity)
	wind: WindEntity;

	@Expose()
	@IsNumber()
	clouds: number;

	@Expose()
	@IsOptional()
	@IsNumber()
	rain: number | null = null;

	@Expose()
	@IsOptional()
	@IsNumber()
	snow: number | null = null;

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

export class LocationEntity {
	@Expose()
	@IsString()
	name: string;

	@Expose()
	@IsOptional()
	@IsString()
	country?: string = null;
}

export class LocationWeatherEntity {
	@Expose()
	@ValidateNested()
	@Type(() => CurrentDayEntity)
	current: CurrentDayEntity;

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ForecastDayEntity)
	forecast: ForecastDayEntity[];

	@Expose()
	@ValidateNested()
	@Type(() => LocationEntity)
	location: LocationEntity;
}
