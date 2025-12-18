import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';
import { CreateLocationDto } from '../../modules/weather/dto/create-location.dto';
import { UpdateLocationDto } from '../../modules/weather/dto/update-location.dto';
import { WeatherLocationEntity } from '../../modules/weather/entities/locations.entity';
import { LocationsTypeMapperService } from '../../modules/weather/services/locations-type-mapper.service';
import { WeatherProviderRegistryService } from '../../modules/weather/services/weather-provider-registry.service';
import { WeatherModule } from '../../modules/weather/weather.module';

import { CreateOpenWeatherMapLocationDto } from './dto/create-location.dto';
import { UpdateOpenWeatherMapConfigDto } from './dto/update-config.dto';
import { UpdateOpenWeatherMapLocationDto } from './dto/update-location.dto';
import { OpenWeatherMapLocationEntity } from './entities/locations-openweathermap.entity';
import { OpenWeatherMapConfigModel } from './models/config.model';
import { OpenWeatherMapProvider } from './platforms/openweathermap.provider';
import { OpenWeatherMapHttpService } from './services/openweathermap-http.service';
import {
	WEATHER_OPENWEATHERMAP_PLUGIN_API_TAG_DESCRIPTION,
	WEATHER_OPENWEATHERMAP_PLUGIN_API_TAG_NAME,
	WEATHER_OPENWEATHERMAP_PLUGIN_NAME,
	WEATHER_OPENWEATHERMAP_PLUGIN_TYPE,
} from './weather-openweathermap.constants';
import { WEATHER_OPENWEATHERMAP_PLUGIN_SWAGGER_EXTRA_MODELS } from './weather-openweathermap.openapi';

@ApiTag({
	tagName: WEATHER_OPENWEATHERMAP_PLUGIN_NAME,
	displayName: WEATHER_OPENWEATHERMAP_PLUGIN_API_TAG_NAME,
	description: WEATHER_OPENWEATHERMAP_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([OpenWeatherMapLocationEntity]),
		WeatherModule,
		ConfigModule,
		SwaggerModule,
		ExtensionsModule,
	],
	providers: [OpenWeatherMapHttpService, OpenWeatherMapProvider],
	exports: [OpenWeatherMapHttpService, OpenWeatherMapProvider],
})
export class WeatherOpenweathermapPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly locationsMapper: LocationsTypeMapperService,
		private readonly providerRegistry: WeatherProviderRegistryService,
		private readonly openWeatherMapProvider: OpenWeatherMapProvider,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		// Register plugin configuration
		this.configMapper.registerMapping<OpenWeatherMapConfigModel, UpdateOpenWeatherMapConfigDto>({
			type: WEATHER_OPENWEATHERMAP_PLUGIN_NAME,
			class: OpenWeatherMapConfigModel,
			configDto: UpdateOpenWeatherMapConfigDto,
		});

		// Register location type mapping
		this.locationsMapper.registerMapping<
			OpenWeatherMapLocationEntity,
			CreateOpenWeatherMapLocationDto,
			UpdateOpenWeatherMapLocationDto
		>({
			type: WEATHER_OPENWEATHERMAP_PLUGIN_TYPE,
			class: OpenWeatherMapLocationEntity,
			createDto: CreateOpenWeatherMapLocationDto,
			updateDto: UpdateOpenWeatherMapLocationDto,
		});

		// Register weather provider
		this.providerRegistry.register(this.openWeatherMapProvider);

		// Register swagger models
		for (const model of WEATHER_OPENWEATHERMAP_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register discriminators for OpenAPI polymorphism
		this.discriminatorRegistry.register({
			parentClass: WeatherLocationEntity,
			discriminatorProperty: 'type',
			discriminatorValue: WEATHER_OPENWEATHERMAP_PLUGIN_TYPE,
			modelClass: OpenWeatherMapLocationEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateLocationDto,
			discriminatorProperty: 'type',
			discriminatorValue: WEATHER_OPENWEATHERMAP_PLUGIN_TYPE,
			modelClass: CreateOpenWeatherMapLocationDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateLocationDto,
			discriminatorProperty: 'type',
			discriminatorValue: WEATHER_OPENWEATHERMAP_PLUGIN_TYPE,
			modelClass: UpdateOpenWeatherMapLocationDto,
		});

		this.extensionsService.registerPluginMetadata({
			type: WEATHER_OPENWEATHERMAP_PLUGIN_NAME,
			name: 'OpenWeatherMap',
			description: 'Weather data provider using OpenWeatherMap API',
			author: 'FastyBird',
			readme: `# OpenWeatherMap Weather Provider

Weather data provider using the OpenWeatherMap Current Weather API.

## Features

- **Current Weather** - Real-time weather conditions
- **Basic Forecast** - Daily weather forecasts
- **Global Coverage** - Weather data for locations worldwide
- **Free Tier** - Works with OpenWeatherMap free API plan

## Setup

1. Create a free account at [OpenWeatherMap](https://openweathermap.org)
2. Generate an API key from your account dashboard
3. Enter the API key in plugin configuration

## Data Provided

- Current temperature
- Weather conditions (clear, cloudy, rain, etc.)
- Humidity and pressure
- Wind speed and direction
- Sunrise and sunset times

## Configuration

- **API Key** - Your OpenWeatherMap API key (required)
- **Units** - Temperature units (metric/imperial)
- **Update Interval** - How often to refresh data

## API Limits

Free tier allows:
- 1,000 API calls per day
- 60 calls per minute`,
			links: {
				documentation: 'https://docs.fastybird.com',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
