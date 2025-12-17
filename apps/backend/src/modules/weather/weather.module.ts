import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../config/config.module';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ExtensionsModule } from '../extensions/extensions.module';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { InfluxDbModule } from '../influxdb/influxdb.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';

import { HistoryController } from './controllers/history.controller';
import { LocationsController } from './controllers/locations.controller';
import { WeatherController } from './controllers/weather.controller';
import { UpdateWeatherConfigDto } from './dto/update-config.dto';
import { WeatherLocationEntity } from './entities/locations.entity';
import { WeatherConfigModel } from './models/config.model';
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
	imports: [
		TypeOrmModule.forFeature([WeatherLocationEntity]),
		ConfigModule,
		SwaggerModule,
		InfluxDbModule,
		ExtensionsModule,
	],
	controllers: [WeatherController, LocationsController, HistoryController],
	providers: [
		WeatherService,
		LocationsService,
		LocationsTypeMapperService,
		WeatherProviderRegistryService,
		WeatherHistoryService,
	],
	exports: [
		WeatherService,
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
		private readonly extensionsService: ExtensionsService,
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

		// Register extension metadata
		this.extensionsService.registerModuleMetadata({
			type: WEATHER_MODULE_NAME,
			name: 'Weather',
			description: 'Weather forecasts and geolocation services',
			author: 'FastyBird',
			links: {
				documentation: 'https://docs.fastybird.com',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
