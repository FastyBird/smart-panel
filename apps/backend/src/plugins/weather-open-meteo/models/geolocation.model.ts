import { Expose } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';

@ApiSchema({ name: 'WeatherOpenMeteoDataGeolocationCity' })
export class OpenMeteoGeolocationCityModel {
	@ApiProperty({
		description: 'City name',
		type: 'string',
		example: 'London',
	})
	@Expose()
	name: string;

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
		description: 'Administrative region',
		type: 'string',
		example: 'England',
	})
	@Expose()
	state?: string;
}

@ApiSchema({ name: 'WeatherOpenMeteoResGeolocationCityToCoordinates' })
export class OpenMeteoGeolocationCityToCoordinatesResponseModel extends BaseSuccessResponseModel<
	OpenMeteoGeolocationCityModel[]
> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(OpenMeteoGeolocationCityModel) },
	})
	@Expose()
	declare data: OpenMeteoGeolocationCityModel[];
}
