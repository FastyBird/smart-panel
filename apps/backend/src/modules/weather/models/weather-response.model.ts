import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../common/dto/response.dto';

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
	@Type(() => LocationWeatherModel)
	data: LocationWeatherModel;
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
	@Type(() => CurrentDayModel)
	data: CurrentDayModel;
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
	@Type(() => ForecastDayModel)
	data: ForecastDayModel[];
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
	@Type(() => GeolocationCityModel)
	data: GeolocationCityModel[];
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
	@Type(() => GeolocationCityModel)
	data: GeolocationCityModel[];
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
	@Type(() => GeolocationZipModel)
	data: GeolocationZipModel;
}
