/**
 * OpenAPI extra models for Weather module
 */
import { WeatherLocationEntity } from './entities/locations.entity';
import { GeolocationCityModel, GeolocationZipModel } from './models/geolocation.model';
import { LocationResponseModel, LocationsResponseModel } from './models/locations-response.model';
import {
	AllLocationsWeatherResponseModel,
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

export const WEATHER_SWAGGER_EXTRA_MODELS = [
	// Response models
	LocationWeatherResponseModel,
	AllLocationsWeatherResponseModel,
	LocationCurrentResponseModel,
	LocationForecastResponseModel,
	GeolocationCityToCoordinatesResponseModel,
	GeolocationCoordinatesToCityResponseModel,
	GeolocationZipToCoordinatesResponseModel,
	LocationResponseModel,
	LocationsResponseModel,
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
	WeatherLocationEntity,
];
