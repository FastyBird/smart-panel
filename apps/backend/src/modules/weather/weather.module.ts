import { Module } from '@nestjs/common';
import { ApiExtraModels } from '@nestjs/swagger';

import { ApiTag } from '../api/decorators/api-tag.decorator';
import { ConfigModule } from '../config/config.module';

import { GeolocationController } from './controllers/geolocation.controller';
import { WeatherController } from './controllers/weather.controller';
import {
	GeolocationCityToCoordinatesResponseModel,
	GeolocationCoordinatesToCityResponseModel,
	GeolocationZipToCoordinatesResponseModel,
	LocationCurrentResponseModel,
	LocationForecastResponseModel,
	LocationWeatherResponseModel,
} from './models/weather-response.model';
import { GeolocationService } from './services/geolocation.service';
import { WeatherService } from './services/weather.service';
import {
	WEATHER_MODULE_API_TAG_DESCRIPTION,
	WEATHER_MODULE_API_TAG_NAME,
	WEATHER_MODULE_NAME,
} from './weather.constants';

@ApiTag({
	tagName: WEATHER_MODULE_NAME,
	displayName: WEATHER_MODULE_API_TAG_NAME,
	description: WEATHER_MODULE_API_TAG_DESCRIPTION,
})
@ApiExtraModels(
	LocationWeatherResponseModel,
	LocationCurrentResponseModel,
	LocationForecastResponseModel,
	GeolocationCityToCoordinatesResponseModel,
	GeolocationCoordinatesToCityResponseModel,
	GeolocationZipToCoordinatesResponseModel,
)
@Module({
	imports: [ConfigModule],
	controllers: [WeatherController, GeolocationController],
	providers: [WeatherService, GeolocationService],
	exports: [WeatherService, GeolocationService],
})
export class WeatherModule {}
