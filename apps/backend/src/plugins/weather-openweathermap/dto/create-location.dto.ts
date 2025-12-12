import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { CreateLocationDto } from '../../../modules/weather/dto/create-location.dto';
import { OpenWeatherMapLocationType, WEATHER_OPENWEATHERMAP_PLUGIN_TYPE } from '../weather-openweathermap.constants';

interface LocationTypeContext {
	locationType: OpenWeatherMapLocationType;
}

@ApiSchema({ name: 'WeatherOpenweathermapPluginCreateLocation' })
export class CreateOpenWeatherMapLocationDto extends CreateLocationDto {
	@ApiProperty({
		description: 'Location type',
		type: 'string',
		default: WEATHER_OPENWEATHERMAP_PLUGIN_TYPE,
		example: WEATHER_OPENWEATHERMAP_PLUGIN_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid location type string."}]' })
	readonly type: typeof WEATHER_OPENWEATHERMAP_PLUGIN_TYPE;

	@ApiProperty({
		description: 'OpenWeatherMap location query type',
		name: 'location_type',
		enum: OpenWeatherMapLocationType,
		example: OpenWeatherMapLocationType.LAT_LON,
	})
	@Expose({ name: 'location_type' })
	@Transform(
		({ obj }: { obj: { location_type?: OpenWeatherMapLocationType; locationType?: OpenWeatherMapLocationType } }) =>
			obj.location_type || obj.locationType,
		{ toClassOnly: true },
	)
	@IsNotEmpty({ message: '[{"field":"location_type","reason":"Location type is required."}]' })
	@IsEnum(OpenWeatherMapLocationType, {
		message: '[{"field":"location_type","reason":"Location type must be a valid OpenWeatherMap location type."}]',
	})
	locationType: OpenWeatherMapLocationType;

	@ApiPropertyOptional({
		description: 'Latitude coordinate (required for lat_lon location type)',
		type: 'number',
		example: 50.0755,
	})
	@Expose()
	@IsOptional()
	@ValidateIf((o: LocationTypeContext) => o.locationType === OpenWeatherMapLocationType.LAT_LON)
	@IsNotEmpty({ message: '[{"field":"latitude","reason":"Latitude is required for lat_lon location type."}]' })
	@IsNumber({}, { message: '[{"field":"latitude","reason":"Latitude must be a number."}]' })
	@Min(-90, { message: '[{"field":"latitude","reason":"Latitude must be between -90 and 90."}]' })
	@Max(90, { message: '[{"field":"latitude","reason":"Latitude must be between -90 and 90."}]' })
	latitude?: number;

	@ApiPropertyOptional({
		description: 'Longitude coordinate (required for lat_lon location type)',
		type: 'number',
		example: 14.4378,
	})
	@Expose()
	@IsOptional()
	@ValidateIf((o: LocationTypeContext) => o.locationType === OpenWeatherMapLocationType.LAT_LON)
	@IsNotEmpty({ message: '[{"field":"longitude","reason":"Longitude is required for lat_lon location type."}]' })
	@IsNumber({}, { message: '[{"field":"longitude","reason":"Longitude must be a number."}]' })
	@Min(-180, { message: '[{"field":"longitude","reason":"Longitude must be between -180 and 180."}]' })
	@Max(180, { message: '[{"field":"longitude","reason":"Longitude must be between -180 and 180."}]' })
	longitude?: number;

	@ApiPropertyOptional({
		description: 'City name (required for city_name location type)',
		name: 'city_name',
		type: 'string',
		example: 'Prague',
	})
	@Expose({ name: 'city_name' })
	@Transform(({ obj }: { obj: { city_name?: string; cityName?: string } }) => obj.city_name || obj.cityName, {
		toClassOnly: true,
	})
	@IsOptional()
	@ValidateIf((o: LocationTypeContext) => o.locationType === OpenWeatherMapLocationType.CITY_NAME)
	@IsNotEmpty({ message: '[{"field":"city_name","reason":"City name is required for city_name location type."}]' })
	@IsString({ message: '[{"field":"city_name","reason":"City name must be a string."}]' })
	cityName?: string;

	@ApiPropertyOptional({
		description: 'Country code (optional for city_name location type)',
		name: 'country_code',
		type: 'string',
		example: 'CZ',
	})
	@Expose({ name: 'country_code' })
	@Transform(
		({ obj }: { obj: { country_code?: string; countryCode?: string } }) => obj.country_code || obj.countryCode,
		{
			toClassOnly: true,
		},
	)
	@IsOptional()
	@IsString({ message: '[{"field":"country_code","reason":"Country code must be a string."}]' })
	countryCode?: string;

	@ApiPropertyOptional({
		description: 'OpenWeatherMap city ID (required for city_id location type)',
		name: 'city_id',
		type: 'number',
		example: 3067696,
	})
	@Expose({ name: 'city_id' })
	@Transform(({ obj }: { obj: { city_id?: number; cityId?: number } }) => obj.city_id || obj.cityId, {
		toClassOnly: true,
	})
	@IsOptional()
	@ValidateIf((o: LocationTypeContext) => o.locationType === OpenWeatherMapLocationType.CITY_ID)
	@IsNotEmpty({ message: '[{"field":"city_id","reason":"City ID is required for city_id location type."}]' })
	@IsNumber({}, { message: '[{"field":"city_id","reason":"City ID must be a number."}]' })
	cityId?: number;

	@ApiPropertyOptional({
		description: 'ZIP/Postal code (required for zip_code location type)',
		name: 'zip_code',
		type: 'string',
		example: '110 00,CZ',
	})
	@Expose({ name: 'zip_code' })
	@Transform(({ obj }: { obj: { zip_code?: string; zipCode?: string } }) => obj.zip_code || obj.zipCode, {
		toClassOnly: true,
	})
	@IsOptional()
	@ValidateIf((o: LocationTypeContext) => o.locationType === OpenWeatherMapLocationType.ZIP_CODE)
	@IsNotEmpty({ message: '[{"field":"zip_code","reason":"ZIP code is required for zip_code location type."}]' })
	@IsString({ message: '[{"field":"zip_code","reason":"ZIP code must be a string."}]' })
	zipCode?: string;
}
