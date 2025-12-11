import { Module, OnModuleInit } from '@nestjs/common';

import { ConfigModule } from '../config/config.module';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';

import { GeolocationController } from './controllers/geolocation.controller';
import { WeatherController } from './controllers/weather.controller';
import { UpdateWeatherConfigDto } from './dto/update-config.dto';
import { WeatherConfigModel } from './models/config.model';
import { GeolocationService } from './services/geolocation.service';
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
	imports: [ConfigModule],
	controllers: [WeatherController, GeolocationController],
	providers: [WeatherService, GeolocationService],
	exports: [WeatherService, GeolocationService],
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
