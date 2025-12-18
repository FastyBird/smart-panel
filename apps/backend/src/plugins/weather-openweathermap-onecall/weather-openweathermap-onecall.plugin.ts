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

import { OpenWeatherMapOneCallGeolocationController } from './controllers/geolocation.controller';
import { CreateOpenWeatherMapOneCallLocationDto } from './dto/create-location.dto';
import { UpdateOpenWeatherMapOneCallConfigDto } from './dto/update-config.dto';
import { UpdateOpenWeatherMapOneCallLocationDto } from './dto/update-location.dto';
import { OpenWeatherMapOneCallLocationEntity } from './entities/locations-openweathermap-onecall.entity';
import { OpenWeatherMapOneCallConfigModel } from './models/config.model';
import { OpenWeatherMapOneCallProvider } from './platforms/openweathermap-onecall.provider';
import { OpenWeatherMapOneCallGeolocationService } from './services/openweathermap-onecall-geolocation.service';
import { OpenWeatherMapOneCallHttpService } from './services/openweathermap-onecall-http.service';
import {
	WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_API_TAG_DESCRIPTION,
	WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_API_TAG_NAME,
	WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME,
	WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_TYPE,
} from './weather-openweathermap-onecall.constants';
import { WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_SWAGGER_EXTRA_MODELS } from './weather-openweathermap-onecall.openapi';

@ApiTag({
	tagName: WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME,
	displayName: WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_API_TAG_NAME,
	description: WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([OpenWeatherMapOneCallLocationEntity]),
		WeatherModule,
		ConfigModule,
		SwaggerModule,
		ExtensionsModule,
	],
	controllers: [OpenWeatherMapOneCallGeolocationController],
	providers: [OpenWeatherMapOneCallHttpService, OpenWeatherMapOneCallGeolocationService, OpenWeatherMapOneCallProvider],
	exports: [OpenWeatherMapOneCallHttpService, OpenWeatherMapOneCallGeolocationService, OpenWeatherMapOneCallProvider],
})
export class WeatherOpenweathermapOnecallPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly locationsMapper: LocationsTypeMapperService,
		private readonly providerRegistry: WeatherProviderRegistryService,
		private readonly openWeatherMapOneCallProvider: OpenWeatherMapOneCallProvider,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		// Register plugin configuration
		this.configMapper.registerMapping<OpenWeatherMapOneCallConfigModel, UpdateOpenWeatherMapOneCallConfigDto>({
			type: WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME,
			class: OpenWeatherMapOneCallConfigModel,
			configDto: UpdateOpenWeatherMapOneCallConfigDto,
		});

		// Register location type mapping
		this.locationsMapper.registerMapping<
			OpenWeatherMapOneCallLocationEntity,
			CreateOpenWeatherMapOneCallLocationDto,
			UpdateOpenWeatherMapOneCallLocationDto
		>({
			type: WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_TYPE,
			class: OpenWeatherMapOneCallLocationEntity,
			createDto: CreateOpenWeatherMapOneCallLocationDto,
			updateDto: UpdateOpenWeatherMapOneCallLocationDto,
		});

		// Register weather provider
		this.providerRegistry.register(this.openWeatherMapOneCallProvider);

		// Register swagger models
		for (const model of WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register discriminators for OpenAPI polymorphism
		this.discriminatorRegistry.register({
			parentClass: WeatherLocationEntity,
			discriminatorProperty: 'type',
			discriminatorValue: WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_TYPE,
			modelClass: OpenWeatherMapOneCallLocationEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateLocationDto,
			discriminatorProperty: 'type',
			discriminatorValue: WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_TYPE,
			modelClass: CreateOpenWeatherMapOneCallLocationDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateLocationDto,
			discriminatorProperty: 'type',
			discriminatorValue: WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_TYPE,
			modelClass: UpdateOpenWeatherMapOneCallLocationDto,
		});

		this.extensionsService.registerPluginMetadata({
			type: WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME,
			name: 'OpenWeatherMap One Call',
			description: 'Weather data provider using OpenWeatherMap One Call API',
			author: 'FastyBird',
			readme: `# OpenWeatherMap One Call Weather Provider

Weather data provider using the OpenWeatherMap One Call 3.0 API.

## Features

- **Comprehensive Data** - Current, hourly, and daily forecasts in one call
- **8-Day Forecast** - Extended daily weather predictions
- **48-Hour Hourly** - Detailed hourly forecast
- **Weather Alerts** - Government weather warnings (where available)
- **Geolocation** - Search locations by city name

## Setup

1. Create an account at [OpenWeatherMap](https://openweathermap.org)
2. Subscribe to One Call API 3.0 (has free tier with 1000 calls/day)
3. Enter your API key in plugin configuration

## Data Provided

- Current conditions with "feels like" temperature
- Hourly forecasts for 48 hours
- Daily forecasts for 8 days
- UV index
- Precipitation probability
- Weather alerts

## Configuration

- **API Key** - Your OpenWeatherMap API key (required)
- **Units** - Temperature units (metric/imperial)

## Geolocation

This plugin includes a location search feature to find coordinates by city name, making it easy to set up weather locations.`,
			links: {
				documentation: 'https://docs.fastybird.com',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
