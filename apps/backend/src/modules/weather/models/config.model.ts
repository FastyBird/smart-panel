import { Expose } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { TemperatureUnitType } from '../../system/system.constants';
import { WeatherLocationType } from '../weather.constants';
import { ModuleConfigModel } from '../../config/models/config.model';
import { WEATHER_MODULE_NAME } from '../weather.constants';

@ApiSchema({ name: 'ConfigModuleDataWeather' })
export class WeatherConfigModel extends ModuleConfigModel {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'weather-module',
	})
	@Expose()
	@IsString()
	type: string = WEATHER_MODULE_NAME;

	@ApiProperty({
		name: 'location_type',
		description: 'Type of location data',
		enum: WeatherLocationType,
		example: WeatherLocationType.LAT_LON,
	})
	@Expose({ name: 'location_type' })
	@IsEnum(WeatherLocationType)
	locationType: WeatherLocationType = WeatherLocationType.LAT_LON;

	@ApiProperty({
		description: 'Temperature unit preference',
		enum: TemperatureUnitType,
		example: TemperatureUnitType.CELSIUS,
	})
	@Expose()
	@IsEnum(TemperatureUnitType)
	unit: TemperatureUnitType = TemperatureUnitType.CELSIUS;

	@ApiPropertyOptional({
		name: 'open_weather_api_key',
		description: 'OpenWeatherMap API key',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'open_weather_api_key' })
	@IsOptional()
	@IsString()
	openWeatherApiKey: string | null = null;

	// Lat/Lon specific fields
	@ApiPropertyOptional({
		description: 'Latitude coordinate (-90 to 90)',
		type: 'number',
		format: 'float',
		minimum: -90,
		maximum: 90,
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@IsNumber()
	@Min(-90)
	@Max(90)
	latitude: number | null = null;

	@ApiPropertyOptional({
		description: 'Longitude coordinate (-180 to 180)',
		type: 'number',
		format: 'float',
		minimum: -180,
		maximum: 180,
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@IsNumber()
	@Min(-180)
	@Max(180)
	longitude: number | null = null;

	// City name specific fields
	@ApiPropertyOptional({
		name: 'city_name',
		description: 'City name with optional country code',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'city_name' })
	@IsOptional()
	@IsString()
	cityName: string | null = null;

	// City ID specific fields
	@ApiPropertyOptional({
		name: 'city_id',
		description: 'OpenWeatherMap city ID',
		type: 'integer',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'city_id' })
	@IsOptional()
	@IsInt()
	cityId: number | null = null;

	// Zip code specific fields
	@ApiPropertyOptional({
		name: 'zip_code',
		description: 'ZIP code with optional country code',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'zip_code' })
	@IsOptional()
	@IsString()
	zipCode: string | null = null;
}
