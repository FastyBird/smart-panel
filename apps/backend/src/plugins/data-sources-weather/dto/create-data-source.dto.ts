import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, Min, ValidateIf } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { CreateSingleDataSourceDto } from '../../../modules/dashboard/dto/create-data-source.dto';
import {
	DATA_SOURCES_WEATHER_CURRENT_TYPE,
	DATA_SOURCES_WEATHER_FORECAST_DAY_TYPE,
	WeatherDataField,
} from '../data-sources-weather.constants';

@ApiSchema({ name: 'DataSourcesWeatherPluginCreateCurrentWeatherDataSource' })
export class CreateCurrentWeatherDataSourceDto extends CreateSingleDataSourceDto {
	@ApiProperty({
		description: 'Data source type',
		type: 'string',
		default: DATA_SOURCES_WEATHER_CURRENT_TYPE,
		example: DATA_SOURCES_WEATHER_CURRENT_TYPE,
	})
	readonly type: typeof DATA_SOURCES_WEATHER_CURRENT_TYPE;

	@ApiPropertyOptional({
		name: 'location_id',
		description: 'Weather location ID. If not set, uses primary location.',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
		nullable: true,
	})
	@Expose({ name: 'location_id' })
	@Transform(
		({ obj }: { obj: { location_id?: string | null; locationId?: string | null } }) =>
			obj.location_id ?? obj.locationId,
		{ toClassOnly: true },
	)
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"location_id","reason":"Location ID must be a valid UUID (version 4)."}]' })
	location?: string | null;

	@ApiProperty({
		description: 'Weather data field to display',
		enum: WeatherDataField,
		example: WeatherDataField.TEMPERATURE,
	})
	@Expose()
	@IsEnum(WeatherDataField, {
		message: '[{"field":"field","reason":"Field must be a valid weather data field."}]',
	})
	field: WeatherDataField;

	@ApiPropertyOptional({
		description: 'Icon name to display (overrides weather icon)',
		type: 'string',
		nullable: true,
		example: 'mdi:thermometer',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@IsString({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@ValidateIf((_, value) => value !== null)
	icon?: string | null;

	@ApiPropertyOptional({
		description: 'Unit suffix to display (e.g., °C, %)',
		type: 'string',
		nullable: true,
		example: '°C',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"unit","reason":"Unit must be a string."}]' })
	@ValidateIf((_, value) => value !== null)
	unit?: string | null;
}

@ApiSchema({ name: 'DataSourcesWeatherPluginCreateForecastDayDataSource' })
export class CreateForecastDayDataSourceDto extends CreateSingleDataSourceDto {
	@ApiProperty({
		description: 'Data source type',
		type: 'string',
		default: DATA_SOURCES_WEATHER_FORECAST_DAY_TYPE,
		example: DATA_SOURCES_WEATHER_FORECAST_DAY_TYPE,
	})
	readonly type: typeof DATA_SOURCES_WEATHER_FORECAST_DAY_TYPE;

	@ApiPropertyOptional({
		name: 'location_id',
		description: 'Weather location ID. If not set, uses primary location.',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
		nullable: true,
	})
	@Expose({ name: 'location_id' })
	@Transform(
		({ obj }: { obj: { location_id?: string | null; locationId?: string | null } }) =>
			obj.location_id ?? obj.locationId,
		{ toClassOnly: true },
	)
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"location_id","reason":"Location ID must be a valid UUID (version 4)."}]' })
	location?: string | null;

	@ApiProperty({
		name: 'day_offset',
		description: 'Day offset from today (0 = today, 1 = tomorrow, etc.)',
		type: 'number',
		minimum: 0,
		maximum: 7,
		example: 1,
	})
	@Expose({ name: 'day_offset' })
	@Transform(({ obj }: { obj: { day_offset?: number; dayOffset?: number } }) => obj.day_offset ?? obj.dayOffset, {
		toClassOnly: true,
	})
	@IsNumber({}, { message: '[{"field":"day_offset","reason":"Day offset must be a number."}]' })
	@Min(0, { message: '[{"field":"day_offset","reason":"Day offset must be at least 0."}]' })
	@Max(7, { message: '[{"field":"day_offset","reason":"Day offset must be at most 7."}]' })
	dayOffset: number;

	@ApiProperty({
		description: 'Weather data field to display',
		enum: WeatherDataField,
		example: WeatherDataField.TEMPERATURE_MAX,
	})
	@Expose()
	@IsEnum(WeatherDataField, {
		message: '[{"field":"field","reason":"Field must be a valid weather data field."}]',
	})
	field: WeatherDataField;

	@ApiPropertyOptional({
		description: 'Icon name to display (overrides weather icon)',
		type: 'string',
		nullable: true,
		example: 'mdi:thermometer',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@IsString({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@ValidateIf((_, value) => value !== null)
	icon?: string | null;

	@ApiPropertyOptional({
		description: 'Unit suffix to display (e.g., °C, %)',
		type: 'string',
		nullable: true,
		example: '°C',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"unit","reason":"Unit must be a string."}]' })
	@ValidateIf((_, value) => value !== null)
	unit?: string | null;
}
