import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ChildEntity, Column, ManyToOne, RelationId } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { DataSourceEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { WeatherLocationEntity } from '../../../modules/weather/entities/locations.entity';
import {
	DATA_SOURCES_WEATHER_CURRENT_TYPE,
	DATA_SOURCES_WEATHER_FORECAST_DAY_TYPE,
	WeatherDataField,
} from '../data-sources-weather.constants';

/**
 * Data source for displaying current weather information
 */
@ApiSchema({ name: 'DataSourcesWeatherPluginDataCurrentWeatherDataSource' })
@ChildEntity()
export class CurrentWeatherDataSourceEntity extends DataSourceEntity {
	@ApiProperty({
		description: 'Data source type',
		type: 'string',
		default: DATA_SOURCES_WEATHER_CURRENT_TYPE,
		example: DATA_SOURCES_WEATHER_CURRENT_TYPE,
	})
	@Expose()
	get type(): string {
		return DATA_SOURCES_WEATHER_CURRENT_TYPE;
	}

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
		({ value }: { value: WeatherLocationEntity | string | null }) =>
			value === null ? null : typeof value === 'string' ? value : value?.id,
		{ toPlainOnly: true },
	)
	@IsOptional()
	@IsUUID('4')
	@ManyToOne(() => WeatherLocationEntity, { onDelete: 'SET NULL', nullable: true })
	location?: WeatherLocationEntity | string | null;

	@RelationId((entity: CurrentWeatherDataSourceEntity) => entity.location)
	locationId?: string | null;

	@ApiProperty({
		description: 'Weather data field to display',
		enum: WeatherDataField,
		example: WeatherDataField.TEMPERATURE,
	})
	@Expose()
	@IsEnum(WeatherDataField)
	@Column({ type: 'varchar', default: WeatherDataField.TEMPERATURE })
	field: WeatherDataField;

	@ApiPropertyOptional({
		description: 'Icon name to display (overrides weather icon)',
		type: 'string',
		nullable: true,
		example: 'mdi:thermometer',
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	icon?: string | null;

	@ApiPropertyOptional({
		description: 'Unit suffix to display (e.g., °C, %)',
		type: 'string',
		nullable: true,
		example: '°C',
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	unit?: string | null;
}

/**
 * Data source for displaying forecast weather information for a specific day
 */
@ApiSchema({ name: 'DataSourcesWeatherPluginDataForecastDayDataSource' })
@ChildEntity()
export class ForecastDayDataSourceEntity extends DataSourceEntity {
	@ApiProperty({
		description: 'Data source type',
		type: 'string',
		default: DATA_SOURCES_WEATHER_FORECAST_DAY_TYPE,
		example: DATA_SOURCES_WEATHER_FORECAST_DAY_TYPE,
	})
	@Expose()
	get type(): string {
		return DATA_SOURCES_WEATHER_FORECAST_DAY_TYPE;
	}

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
		({ value }: { value: WeatherLocationEntity | string | null }) =>
			value === null ? null : typeof value === 'string' ? value : value?.id,
		{ toPlainOnly: true },
	)
	@IsOptional()
	@IsUUID('4')
	@ManyToOne(() => WeatherLocationEntity, { onDelete: 'SET NULL', nullable: true })
	location?: WeatherLocationEntity | string | null;

	@RelationId((entity: ForecastDayDataSourceEntity) => entity.location)
	locationId?: string | null;

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
	@IsNumber()
	@Min(0)
	@Max(7)
	@Column({ type: 'int', default: 1 })
	dayOffset: number;

	@ApiProperty({
		description: 'Weather data field to display',
		enum: WeatherDataField,
		example: WeatherDataField.TEMPERATURE_MAX,
	})
	@Expose()
	@IsEnum(WeatherDataField)
	@Column({ type: 'varchar', default: WeatherDataField.TEMPERATURE_MAX })
	field: WeatherDataField;

	@ApiPropertyOptional({
		description: 'Icon name to display (overrides weather icon)',
		type: 'string',
		nullable: true,
		example: 'mdi:thermometer',
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	icon?: string | null;

	@ApiPropertyOptional({
		description: 'Unit suffix to display (e.g., °C, %)',
		type: 'string',
		nullable: true,
		example: '°C',
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	unit?: string | null;
}
