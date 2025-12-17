/**
 * OpenAPI extra models for Weather module
 */
import { WeatherLocationEntity } from './entities/locations.entity';
import { LocationAlertsResponseModel, WeatherAlertModel } from './models/alert.model';
import {
	WeatherHistoryPointModel,
	WeatherHistoryResponseModel,
	WeatherStatisticsModel,
	WeatherStatisticsResponseModel,
} from './models/history.model';
import { LocationResponseModel, LocationsResponseModel } from './models/locations-response.model';
import {
	AllLocationsWeatherResponseModel,
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
	LocationAlertsResponseModel,
	WeatherHistoryResponseModel,
	WeatherStatisticsResponseModel,
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
	WeatherAlertModel,
	WeatherHistoryPointModel,
	WeatherStatisticsModel,
	WeatherLocationEntity,
];
