import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';

import { GeolocationController } from './controllers/geolocation.controller';
import { WeatherController } from './controllers/weather.controller';
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
@Module({
	imports: [ConfigModule],
	controllers: [WeatherController, GeolocationController],
	providers: [WeatherService, GeolocationService],
	exports: [WeatherService, GeolocationService],
})
export class WeatherModule {}
