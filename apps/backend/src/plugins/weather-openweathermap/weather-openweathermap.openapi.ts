/**
 * OpenAPI extra models for Weather OpenWeatherMap plugin
 */
import { CreateOpenWeatherMapLocationDto } from './dto/create-location.dto';
import { UpdateOpenWeatherMapConfigDto } from './dto/update-config.dto';
import { UpdateOpenWeatherMapLocationDto } from './dto/update-location.dto';
import { OpenWeatherMapLocationEntity } from './entities/locations-openweathermap.entity';
import { OpenWeatherMapConfigModel } from './models/config.model';

export const WEATHER_OPENWEATHERMAP_PLUGIN_SWAGGER_EXTRA_MODELS = [
	OpenWeatherMapLocationEntity,
	OpenWeatherMapConfigModel,
	CreateOpenWeatherMapLocationDto,
	UpdateOpenWeatherMapLocationDto,
	UpdateOpenWeatherMapConfigDto,
];
