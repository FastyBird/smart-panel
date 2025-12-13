/**
 * OpenAPI extra models for Weather OpenWeatherMap One Call 3.0 plugin
 */
import { CreateOpenWeatherMapOneCallLocationDto } from './dto/create-location.dto';
import { UpdateOpenWeatherMapOneCallConfigDto } from './dto/update-config.dto';
import { UpdateOpenWeatherMapOneCallLocationDto } from './dto/update-location.dto';
import { OpenWeatherMapOneCallLocationEntity } from './entities/locations-openweathermap-onecall.entity';
import { OpenWeatherMapOneCallConfigModel } from './models/config.model';

export const WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_SWAGGER_EXTRA_MODELS = [
	OpenWeatherMapOneCallLocationEntity,
	OpenWeatherMapOneCallConfigModel,
	CreateOpenWeatherMapOneCallLocationDto,
	UpdateOpenWeatherMapOneCallLocationDto,
	UpdateOpenWeatherMapOneCallConfigDto,
];
