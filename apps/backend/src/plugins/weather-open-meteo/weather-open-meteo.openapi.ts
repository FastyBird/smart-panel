/**
 * OpenAPI extra models for Weather Open-Meteo plugin
 */
import { CreateOpenMeteoLocationDto } from './dto/create-location.dto';
import { UpdateOpenMeteoConfigDto } from './dto/update-config.dto';
import { UpdateOpenMeteoLocationDto } from './dto/update-location.dto';
import { OpenMeteoLocationEntity } from './entities/locations-open-meteo.entity';
import { OpenMeteoConfigModel } from './models/config.model';
import {
	OpenMeteoGeolocationCityModel,
	OpenMeteoGeolocationCityToCoordinatesResponseModel,
} from './models/geolocation.model';

export const WEATHER_OPEN_METEO_PLUGIN_SWAGGER_EXTRA_MODELS = [
	OpenMeteoLocationEntity,
	OpenMeteoConfigModel,
	CreateOpenMeteoLocationDto,
	UpdateOpenMeteoLocationDto,
	UpdateOpenMeteoConfigDto,
	OpenMeteoGeolocationCityModel,
	OpenMeteoGeolocationCityToCoordinatesResponseModel,
];
