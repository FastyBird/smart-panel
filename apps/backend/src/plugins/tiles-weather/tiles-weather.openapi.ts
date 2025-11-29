/**
 * OpenAPI extra models for Tiles Weather plugin
 */
import { Type } from '@nestjs/common';

import { DayWeatherTileEntity, ForecastWeatherTileEntity } from './entities/tiles-weather.entity';
import { WeatherConfigModel } from './models/config.model';

export const TILES_WEATHER_PLUGIN_SWAGGER_EXTRA_MODELS: Type<any>[] = [
	// Data models
	WeatherConfigModel,
	// Entities
	DayWeatherTileEntity,
	ForecastWeatherTileEntity,
];
