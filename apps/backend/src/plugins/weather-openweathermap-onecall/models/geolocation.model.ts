import { Expose } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';

@ApiSchema({ name: 'WeatherOpenweathermapOnecallDataGeolocationCity' })
export class GeolocationCityModel {
	@ApiProperty({
		description: 'City name',
		type: 'string',
		example: 'London',
	})
	@Expose()
	name: string;

	@ApiPropertyOptional({
		description: 'Local names in different languages',
		type: 'object',
		additionalProperties: { type: 'string' },
	})
	@Expose()
	localNames?: Record<string, string>;

	@ApiProperty({
		description: 'Latitude',
		type: 'number',
		example: 51.5074,
	})
	@Expose()
	lat: number;

	@ApiProperty({
		description: 'Longitude',
		type: 'number',
		example: -0.1278,
	})
	@Expose()
	lon: number;

	@ApiProperty({
		description: 'Country code',
		type: 'string',
		example: 'GB',
	})
	@Expose()
	country: string;

	@ApiPropertyOptional({
		description: 'State or region',
		type: 'string',
		example: 'England',
	})
	@Expose()
	state?: string;
}

@ApiSchema({ name: 'WeatherOpenweathermapOnecallDataGeolocationZip' })
export class GeolocationZipModel {
	@ApiProperty({
		description: 'ZIP/postal code',
		type: 'string',
		example: '10001',
	})
	@Expose()
	zip: string;

	@ApiProperty({
		description: 'Location name',
		type: 'string',
		example: 'New York',
	})
	@Expose()
	name: string;

	@ApiProperty({
		description: 'Latitude',
		type: 'number',
		example: 40.7484,
	})
	@Expose()
	lat: number;

	@ApiProperty({
		description: 'Longitude',
		type: 'number',
		example: -73.9967,
	})
	@Expose()
	lon: number;

	@ApiProperty({
		description: 'Country code',
		type: 'string',
		example: 'US',
	})
	@Expose()
	country: string;
}

@ApiSchema({ name: 'WeatherOpenweathermapOnecallResGeolocationCityToCoordinates' })
export class GeolocationCityToCoordinatesResponseModel extends BaseSuccessResponseModel<GeolocationCityModel[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(GeolocationCityModel) },
	})
	@Expose()
	declare data: GeolocationCityModel[];
}

@ApiSchema({ name: 'WeatherOpenweathermapOnecallResGeolocationCoordinatesToCity' })
export class GeolocationCoordinatesToCityResponseModel extends BaseSuccessResponseModel<GeolocationCityModel[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(GeolocationCityModel) },
	})
	@Expose()
	declare data: GeolocationCityModel[];
}

@ApiSchema({ name: 'WeatherOpenweathermapOnecallResGeolocationZipToCoordinates' })
export class GeolocationZipToCoordinatesResponseModel extends BaseSuccessResponseModel<GeolocationZipModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => GeolocationZipModel,
	})
	@Expose()
	declare data: GeolocationZipModel;
}
