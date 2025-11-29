/**
 * OpenAPI extra models for Tiles Weather plugin
 */
import { DayWeatherTileEntity, ForecastWeatherTileEntity } from './entities/tiles-weather.entity';
import { WeatherConfigModel } from './models/config.model';

export const TILES_WEATHER_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// Data models
	WeatherConfigModel,
	// Entities
	DayWeatherTileEntity,
	ForecastWeatherTileEntity,
];
