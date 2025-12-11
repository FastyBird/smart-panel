import { Expose } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from '../../config/dto/config.dto';
import { TemperatureUnitType, WeatherLocationType } from '../../config/config.constants';
import { WEATHER_MODULE_NAME } from '../weather.constants';

@ApiSchema({ name: 'ConfigModuleUpdateWeather' })
export class UpdateWeatherConfigDto extends UpdateModuleConfigDto {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'weather-module',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string = WEATHER_MODULE_NAME;

	@ApiPropertyOptional({
		description: 'Type of location data provided.',
		enum: WeatherLocationType,
		example: WeatherLocationType.LAT_LON,
	})
	@Expose({ name: 'location_type' })
	@IsOptional()
	@IsEnum(WeatherLocationType, {
		message: '[{"field":"location_type","reason":"Location type must be a valid location type."}]',
	})
	location_type?: WeatherLocationType;

	@ApiPropertyOptional({
		description: 'Temperature unit preference.',
		enum: TemperatureUnitType,
		example: TemperatureUnitType.CELSIUS,
	})
	@Expose()
	@IsOptional()
	@IsEnum(TemperatureUnitType, { message: '[{"field":"unit","reason":"Unit must be a valid string."}]' })
	unit?: TemperatureUnitType;

	@ApiPropertyOptional({
		description: 'OpenWeatherMap API key.',
		type: 'string',
		example: 'your-api-key-here',
		nullable: true,
	})
	@Expose({ name: 'open_weather_api_key' })
	@IsOptional()
	@IsString({ message: '[{"field":"open_weather_api_key","reason":"OpenWeather API key must be a valid string."}]' })
	open_weather_api_key?: string | null;

	// Lat/Lon specific fields
	@ApiPropertyOptional({
		description: 'Latitude coordinate (-90 to 90).',
		type: 'number',
		format: 'float',
		minimum: -90,
		maximum: 90,
		example: 50.0755,
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"latitude","reason":"Latitude must be a valid number."}]' },
	)
	@Min(-90, { message: '[{"field":"latitude","reason":"Latitude must be greater than -90."}]' })
	@Max(90, { message: '[{"field":"latitude","reason":"Latitude must be lower than 90."}]' })
	@ValidateIf((_, value) => value !== null)
	latitude?: number | null;

	@ApiPropertyOptional({
		description: 'Longitude coordinate (-180 to 180).',
		type: 'number',
		format: 'float',
		minimum: -180,
		maximum: 180,
		example: 14.4378,
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"longitude","reason":"Longitude must be a valid number."}]' },
	)
	@Min(-180, { message: '[{"field":"longitude","reason":"Longitude must be greater than -180."}]' })
	@Max(180, { message: '[{"field":"longitude","reason":"Longitude must be lower than 180."}]' })
	@ValidateIf((_, value) => value !== null)
	longitude?: number | null;

	// City name specific fields
	@ApiPropertyOptional({
		description: 'City name with optional country code (e.g., "Prague,CZ").',
		type: 'string',
		example: 'Prague,CZ',
		nullable: true,
	})
	@Expose({ name: 'city_name' })
	@IsOptional()
	@IsString({ message: '[{"field":"city_name","reason":"City name must be a valid string."}]' })
	@ValidateIf((_, value) => value !== null)
	city_name?: string | null;

	// City ID specific fields
	@ApiPropertyOptional({
		description: 'OpenWeatherMap city ID.',
		type: 'integer',
		example: 3067696,
		nullable: true,
	})
	@Expose({ name: 'city_id' })
	@IsOptional()
	@IsInt({ message: '[{"field":"city_id","reason":"City ID must be a valid integer."}]' })
	@ValidateIf((_, value) => value !== null)
	city_id?: number | null;

	// Zip code specific fields
	@ApiPropertyOptional({
		description: 'ZIP code with optional country code (e.g., "10001,US").',
		type: 'string',
		example: '10001,US',
		nullable: true,
	})
	@Expose({ name: 'zip_code' })
	@IsOptional()
	@IsString({ message: '[{"field":"zip_code","reason":"ZIP code must be a valid string."}]' })
	@ValidateIf((_, value) => value !== null)
	zip_code?: string | null;
}
