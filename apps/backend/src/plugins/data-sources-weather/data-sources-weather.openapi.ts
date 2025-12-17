/**
 * OpenAPI extra models for Weather Data Sources plugin
 */
import { CreateCurrentWeatherDataSourceDto, CreateForecastDayDataSourceDto } from './dto/create-data-source.dto';
import { UpdateWeatherDataSourceConfigDto } from './dto/update-config.dto';
import { UpdateCurrentWeatherDataSourceDto, UpdateForecastDayDataSourceDto } from './dto/update-data-source.dto';
import { CurrentWeatherDataSourceEntity, ForecastDayDataSourceEntity } from './entities/data-sources-weather.entity';
import { WeatherDataSourceConfigModel } from './models/config.model';

export const DATA_SOURCES_WEATHER_PLUGIN_SWAGGER_EXTRA_MODELS = [
	CurrentWeatherDataSourceEntity,
	ForecastDayDataSourceEntity,
	WeatherDataSourceConfigModel,
	CreateCurrentWeatherDataSourceDto,
	CreateForecastDayDataSourceDto,
	UpdateCurrentWeatherDataSourceDto,
	UpdateForecastDayDataSourceDto,
	UpdateWeatherDataSourceConfigDto,
];
