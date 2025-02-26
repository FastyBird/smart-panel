import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module';

import { WeatherController } from './controllers/weather.controller';
import { GeolocationService } from './services/geolocation.service';
import { WeatherService } from './services/weather.service';

@Module({
	imports: [ConfigModule],
	controllers: [WeatherController],
	providers: [WeatherService, GeolocationService],
	exports: [WeatherService, GeolocationService],
})
export class WeatherModule {}
