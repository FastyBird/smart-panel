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
	gust?: number;
}

export class LocationEntity {
	@Expose()
	@IsString()
	name: string;

	@Expose()
	@IsOptional()
	@IsString()
	country?: string;
}

export class WeatherInfoEntity {
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

export class WeatherEntity {
	@Expose()
	@IsNumber()
	temperature: number;

	@Expose({ name: 'temperature_min' })
	@IsNumber()
	@Transform(
		({ obj }: { obj: { temperature_min?: number; temperatureMin?: number } }) =>
			obj.temperature_min || obj.temperatureMin,
		{ toClassOnly: true },
	)
	temperatureMin: number;

	@Expose({ name: 'temperature_max' })
	@IsNumber()
	@Transform(
		({ obj }: { obj: { temperature_max?: number; temperatureMax?: number } }) =>
			obj.temperature_max || obj.temperatureMax,
		{ toClassOnly: true },
	)
	temperatureMax: number;

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
	@Type(() => WeatherInfoEntity)
	weather: WeatherInfoEntity;

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

	@Expose()
	@ValidateNested()
	@Type(() => LocationEntity)
	location: LocationEntity;

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

	@Expose({ name: 'created_at' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { created_at?: string | Date; createdAt?: string | Date } }) => {
			const value: string | Date = obj.created_at || obj.createdAt;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: string | Date }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	createdAt: Date;
}

export class ForecastItemEntity {
	@Expose()
	@IsNumber()
	temperature: number;

	@Expose({ name: 'temperature_min' })
	@IsNumber()
	@Transform(
		({ obj }: { obj: { temperature_min?: number; temperatureMin?: number } }) =>
			obj.temperature_min || obj.temperatureMin,
		{ toClassOnly: true },
	)
	temperatureMin: number;

	@Expose({ name: 'temperature_max' })
	@IsNumber()
	@Transform(
		({ obj }: { obj: { temperature_max?: number; temperatureMax?: number } }) =>
			obj.temperature_max || obj.temperatureMax,
		{ toClassOnly: true },
	)
	temperatureMax: number;

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
	@Type(() => WeatherInfoEntity)
	weather: WeatherInfoEntity;

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

	@Expose({ name: 'created_at' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { created_at?: string | Date; createdAt?: string | Date } }) => {
			const value: string | Date = obj.created_at || obj.createdAt;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: string | Date }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	createdAt: Date;
}

export class ForecastEntity {
	@Expose()
	@ValidateNested()
	@Type(() => LocationEntity)
	location: LocationEntity;

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

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ForecastItemEntity)
	forecast: ForecastItemEntity[];
}

export class LocationWeatherEntity {
	@Expose()
	@ValidateNested()
	@Type(() => WeatherEntity)
	weather: WeatherEntity;

	@Expose()
	@ValidateNested()
	@Type(() => ForecastEntity)
	forecast: ForecastEntity;
}
