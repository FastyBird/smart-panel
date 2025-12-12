import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../config/config.module';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { InfluxDbModule } from '../influxdb/influxdb.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';

import { GeolocationController } from './controllers/geolocation.controller';
import { HistoryController } from './controllers/history.controller';
import { LocationsController } from './controllers/locations.controller';
import { ProvidersController } from './controllers/providers.controller';
import { WeatherController } from './controllers/weather.controller';
import { UpdateWeatherConfigDto } from './dto/update-config.dto';
import { WeatherLocationEntity } from './entities/locations.entity';
import { WeatherConfigModel } from './models/config.model';
import { GeolocationService } from './services/geolocation.service';
import { LocationsTypeMapperService } from './services/locations-type-mapper.service';
import { LocationsService } from './services/locations.service';
import { WeatherHistoryService } from './services/weather-history.service';
import { WeatherProviderRegistryService } from './services/weather-provider-registry.service';
import { WeatherService } from './services/weather.service';
import {
	WEATHER_MODULE_API_TAG_DESCRIPTION,
	WEATHER_MODULE_API_TAG_NAME,
	WEATHER_MODULE_NAME,
} from './weather.constants';
import { WEATHER_SWAGGER_EXTRA_MODELS } from './weather.openapi';

@ApiTag({
	tagName: WEATHER_MODULE_NAME,
	displayName: WEATHER_MODULE_API_TAG_NAME,
	description: WEATHER_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [TypeOrmModule.forFeature([WeatherLocationEntity]), ConfigModule, SwaggerModule, InfluxDbModule],
	controllers: [WeatherController, GeolocationController, LocationsController, ProvidersController, HistoryController],
	providers: [
		WeatherService,
		GeolocationService,
		LocationsService,
		LocationsTypeMapperService,
		WeatherProviderRegistryService,
		WeatherHistoryService,
	],
	exports: [
		WeatherService,
		GeolocationService,
		LocationsService,
		LocationsTypeMapperService,
		WeatherProviderRegistryService,
		WeatherHistoryService,
	],
})
export class WeatherModule implements OnModuleInit {
	constructor(
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
	) {}

	onModuleInit() {
		this.modulesMapperService.registerMapping<WeatherConfigModel, UpdateWeatherConfigDto>({
			type: WEATHER_MODULE_NAME,
			class: WeatherConfigModel,
			configDto: UpdateWeatherConfigDto,
		});

		for (const model of WEATHER_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}
	}
}
