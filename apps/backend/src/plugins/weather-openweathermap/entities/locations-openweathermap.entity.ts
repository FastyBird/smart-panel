import { Expose } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';
import { ChildEntity, Column } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { WeatherLocationEntity } from '../../../modules/weather/entities/locations.entity';
import { OpenWeatherMapLocationType, WEATHER_OPENWEATHERMAP_PLUGIN_TYPE } from '../weather-openweathermap.constants';

interface LocationTypeContext {
	locationType: OpenWeatherMapLocationType;
}

@ApiSchema({ name: 'WeatherOpenweathermapPluginDataLocation' })
@ChildEntity()
export class OpenWeatherMapLocationEntity extends WeatherLocationEntity {
	@ApiProperty({
		description: 'Location type',
		type: 'string',
		default: WEATHER_OPENWEATHERMAP_PLUGIN_TYPE,
		example: WEATHER_OPENWEATHERMAP_PLUGIN_TYPE,
	})
	@Expose()
	get type(): string {
		return WEATHER_OPENWEATHERMAP_PLUGIN_TYPE;
	}

	@ApiProperty({
		description: 'OpenWeatherMap location query type',
		name: 'location_type',
		enum: OpenWeatherMapLocationType,
		example: OpenWeatherMapLocationType.LAT_LON,
	})
	@Expose({ name: 'location_type' })
	@IsEnum(OpenWeatherMapLocationType)
	@Column({ type: 'text', enum: OpenWeatherMapLocationType })
	locationType: OpenWeatherMapLocationType;

	@ApiPropertyOptional({
		description: 'Latitude coordinate (required for lat_lon location type)',
		type: 'number',
		example: 50.0755,
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@ValidateIf((o: LocationTypeContext) => o.locationType === OpenWeatherMapLocationType.LAT_LON)
	@IsNumber()
	@Min(-90)
	@Max(90)
	@Column({ type: 'real', nullable: true })
	latitude: number | null;

	@ApiPropertyOptional({
		description: 'Longitude coordinate (required for lat_lon location type)',
		type: 'number',
		example: 14.4378,
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@ValidateIf((o: LocationTypeContext) => o.locationType === OpenWeatherMapLocationType.LAT_LON)
	@IsNumber()
	@Min(-180)
	@Max(180)
	@Column({ type: 'real', nullable: true })
	longitude: number | null;

	@ApiPropertyOptional({
		description: 'City name (required for city_name location type)',
		name: 'city_name',
		type: 'string',
		example: 'Prague',
		nullable: true,
	})
	@Expose({ name: 'city_name' })
	@IsOptional()
	@ValidateIf((o: LocationTypeContext) => o.locationType === OpenWeatherMapLocationType.CITY_NAME)
	@IsString()
	@Column({ nullable: true })
	cityName: string | null;

	@ApiPropertyOptional({
		description: 'Country code (optional for city_name location type)',
		name: 'country_code',
		type: 'string',
		example: 'CZ',
		nullable: true,
	})
	@Expose({ name: 'country_code' })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	countryCode: string | null;

	@ApiPropertyOptional({
		description: 'OpenWeatherMap city ID (required for city_id location type)',
		name: 'city_id',
		type: 'number',
		example: 3067696,
		nullable: true,
	})
	@Expose({ name: 'city_id' })
	@IsOptional()
	@ValidateIf((o: LocationTypeContext) => o.locationType === OpenWeatherMapLocationType.CITY_ID)
	@IsNumber()
	@Column({ type: 'integer', nullable: true })
	cityId: number | null;

	@ApiPropertyOptional({
		description: 'ZIP/Postal code (required for zip_code location type)',
		name: 'zip_code',
		type: 'string',
		example: '110 00,CZ',
		nullable: true,
	})
	@Expose({ name: 'zip_code' })
	@IsOptional()
	@ValidateIf((o: LocationTypeContext) => o.locationType === OpenWeatherMapLocationType.ZIP_CODE)
	@IsString()
	@Column({ nullable: true })
	zipCode: string | null;
}
