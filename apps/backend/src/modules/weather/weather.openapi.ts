/**
 * OpenAPI extra models for Weather module
 */
import { Type } from '@nestjs/common';

import { GeolocationCityModel, GeolocationZipModel } from './models/geolocation.model';
import {
	GeolocationCityToCoordinatesResponseModel,
	GeolocationCoordinatesToCityResponseModel,
	GeolocationZipToCoordinatesResponseModel,
	LocationCurrentResponseModel,
	LocationForecastResponseModel,
	LocationWeatherResponseModel,
} from './models/weather-response.model';
import {
	CurrentDayModel,
	ForecastDayModel,
	ForecastFeelsLikeModel,
	ForecastTemperatureModel,
	LocationModel,
	LocationWeatherModel,
	WeatherModel,
	WindModel,
} from './models/weather.model';

export const WEATHER_SWAGGER_EXTRA_MODELS: Type<any>[] = [
	// Response models
	LocationWeatherResponseModel,
	LocationCurrentResponseModel,
	LocationForecastResponseModel,
	GeolocationCityToCoordinatesResponseModel,
	GeolocationCoordinatesToCityResponseModel,
	GeolocationZipToCoordinatesResponseModel,
	// Data models
	WindModel,
	WeatherModel,
	ForecastTemperatureModel,
	ForecastFeelsLikeModel,
	ForecastDayModel,
	CurrentDayModel,
	LocationModel,
	LocationWeatherModel,
	GeolocationCityModel,
	GeolocationZipModel,
];
