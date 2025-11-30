/**
 * OpenAPI extra models for Tiles Weather plugin
 */
import {
	CreateDayWeatherTileDto,
	CreateForecastWeatherTileDto,
	ReqCreateDayWeatherTileDto,
	ReqCreateForecastWeatherTileDto,
} from './dto/create-tile.dto';
import { WeatherUpdateConfigDto } from './dto/update-config.dto';
import {
	ReqUpdateDayWeatherTileDto,
	ReqUpdateForecastWeatherTileDto,
	UpdateDayWeatherTileDto,
	UpdateForecastWeatherTileDto,
} from './dto/update-tile.dto';
import { DayWeatherTileEntity, ForecastWeatherTileEntity } from './entities/tiles-weather.entity';
import { WeatherConfigModel } from './models/config.model';

export const TILES_WEATHER_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// DTOs
	CreateDayWeatherTileDto,
	CreateForecastWeatherTileDto,
	ReqCreateDayWeatherTileDto,
	ReqCreateForecastWeatherTileDto,
	UpdateDayWeatherTileDto,
	UpdateForecastWeatherTileDto,
	ReqUpdateDayWeatherTileDto,
	ReqUpdateForecastWeatherTileDto,
	WeatherUpdateConfigDto,
	// Data models
	WeatherConfigModel,
	// Entities
	DayWeatherTileEntity,
	ForecastWeatherTileEntity,
];
