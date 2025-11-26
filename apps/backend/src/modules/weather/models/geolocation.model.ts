import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'WeatherModuleGeolocationCity' })
export class GeolocationCityModel {
	@ApiProperty({ description: 'City name', type: 'string', example: 'London' })
	@Expose()
	name: string;

	@ApiPropertyOptional({
		name: 'local_names',
		description: 'City name in different languages',
		example: { en: 'London', ru: 'Лондон' },
	})
	@Expose()
	@Type(() => Object)
	local_names?: Record<string, string>;

	@ApiProperty({ description: 'Latitude', type: 'number', example: 51.5074 })
	@Expose()
	lat: number;

	@ApiProperty({ description: 'Longitude', type: 'number', example: -0.1278 })
	@Expose()
	lon: number;

	@ApiProperty({ description: 'Country code', type: 'string', example: 'GB' })
	@Expose()
	country: string;

	@ApiPropertyOptional({ description: 'State (if applicable)', type: 'string', example: 'England' })
	@Expose()
	state?: string;
}

@ApiSchema({ name: 'WeatherModuleGeolocationZip' })
export class GeolocationZipModel {
	@ApiProperty({ description: 'Zip/postal code', type: 'string', example: 'SW1A 1AA' })
	@Expose()
	zip: string;

	@ApiProperty({ description: 'City name', type: 'string', example: 'London' })
	@Expose()
	name: string;

	@ApiProperty({ description: 'Latitude', type: 'number', example: 51.5074 })
	@Expose()
	lat: number;

	@ApiProperty({ description: 'Longitude', type: 'number', example: -0.1278 })
	@Expose()
	lon: number;

	@ApiProperty({ description: 'Country code', type: 'string', example: 'GB' })
	@Expose()
	country: string;
}

/**
 * Alias for GeolocationCityModel (for OpenAPI spec compatibility)
 */
@ApiSchema({ name: 'WeatherModuleCityGeolocation' })
export class WeatherModuleCityGeolocation extends GeolocationCityModel {}

/**
 * Alias for GeolocationZipModel (for OpenAPI spec compatibility)
 */
@ApiSchema({ name: 'WeatherModuleZipGeolocation' })
export class WeatherModuleZipGeolocation extends GeolocationZipModel {}
