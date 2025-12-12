import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

import { GeolocationCityModel, GeolocationZipModel } from './geolocation.model';
import { CurrentDayModel, ForecastDayModel, LocationWeatherModel } from './weather.model';

/**
 * Response wrapper for LocationWeatherModel
 */
@ApiSchema({ name: 'WeatherModuleResLocationWeather' })
export class LocationWeatherResponseModel extends BaseSuccessResponseModel<LocationWeatherModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => LocationWeatherModel,
	})
	@Expose()
	declare data: LocationWeatherModel;
}

/**
 * Response wrapper for array of LocationWeatherModel
 */
@ApiSchema({ name: 'WeatherModuleResAllLocationsWeather' })
export class AllLocationsWeatherResponseModel extends BaseSuccessResponseModel<LocationWeatherModel[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(LocationWeatherModel) },
	})
	@Expose()
	declare data: LocationWeatherModel[];
}

/**
 * Response wrapper for CurrentDayModel
 */
@ApiSchema({ name: 'WeatherModuleResLocationCurrent' })
export class LocationCurrentResponseModel extends BaseSuccessResponseModel<CurrentDayModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => CurrentDayModel,
	})
	@Expose()
	declare data: CurrentDayModel;
}

/**
 * Response wrapper for array of ForecastDayModel
 */
@ApiSchema({ name: 'WeatherModuleResLocationForecast' })
export class LocationForecastResponseModel extends BaseSuccessResponseModel<ForecastDayModel[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(ForecastDayModel) },
	})
	@Expose()
	declare data: ForecastDayModel[];
}

/**
 * Response wrapper for array of GeolocationCityModel (city to coordinates)
 */
@ApiSchema({ name: 'WeatherModuleResGeolocationCityToCoordinates' })
export class GeolocationCityToCoordinatesResponseModel extends BaseSuccessResponseModel<GeolocationCityModel[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(GeolocationCityModel) },
	})
	@Expose()
	declare data: GeolocationCityModel[];
}

/**
 * Response wrapper for array of GeolocationCityModel (coordinates to city)
 */
@ApiSchema({ name: 'WeatherModuleResGeolocationCoordinatesToCity' })
export class GeolocationCoordinatesToCityResponseModel extends BaseSuccessResponseModel<GeolocationCityModel[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(GeolocationCityModel) },
	})
	@Expose()
	declare data: GeolocationCityModel[];
}

/**
 * Response wrapper for GeolocationZipModel
 */
@ApiSchema({ name: 'WeatherModuleResGeolocationZipToCoordinates' })
export class GeolocationZipToCoordinatesResponseModel extends BaseSuccessResponseModel<GeolocationZipModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => GeolocationZipModel,
	})
	@Expose()
	declare data: GeolocationZipModel;
}
