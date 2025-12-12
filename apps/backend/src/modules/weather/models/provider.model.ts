import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

/**
 * Weather provider information model
 */
@ApiSchema({ name: 'WeatherModuleProvider' })
export class WeatherProviderModel {
	@ApiProperty({
		description: 'Provider type identifier',
		type: 'string',
		example: 'weather-openweathermap',
	})
	@Expose()
	type: string;

	@ApiProperty({
		description: 'Human-readable provider name',
		type: 'string',
		example: 'Weather OpenWeatherMap plugin',
	})
	@Expose()
	name: string;

	@ApiProperty({
		description: 'Provider description',
		type: 'string',
		example: 'Weather provider plugin using OpenWeatherMap API for weather data.',
	})
	@Expose()
	description: string;
}

/**
 * Response wrapper for array of WeatherProviderModel
 */
@ApiSchema({ name: 'WeatherModuleResProviders' })
export class ProvidersResponseModel extends BaseSuccessResponseModel<WeatherProviderModel[]> {
	@ApiProperty({
		description: 'List of available weather providers',
		type: 'array',
		items: { $ref: getSchemaPath(WeatherProviderModel) },
	})
	@Expose()
	declare data: WeatherProviderModel[];
}
