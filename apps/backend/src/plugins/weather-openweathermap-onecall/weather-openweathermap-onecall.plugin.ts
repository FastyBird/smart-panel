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
import { OpenWeatherMapOneCallConfigValidatorService } from './services/openweathermap-onecall-config-validator.service';
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
	providers: [
		OpenWeatherMapOneCallHttpService,
		OpenWeatherMapOneCallGeolocationService,
		OpenWeatherMapOneCallProvider,
		OpenWeatherMapOneCallConfigValidatorService,
	],
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
			name: 'OpenWeatherMap OneCall 3.0',
			description: 'Weather data provider using OpenWeatherMap One Call API',
			author: 'FastyBird',
			readme: `# OpenWeatherMap One Call

> Plugin · by FastyBird · platform: weather

Weather provider backed by the OpenWeatherMap **One Call API 3.0** — current conditions, 48-hour hourly forecast, 8-day daily forecast, UV index, precipitation probability and government weather alerts in a single request. Includes a built-in geolocation lookup to convert city names into coordinates so users can pick a location by name in the admin UI.

## What you get

- The richest forecast available from OpenWeatherMap: hourly resolution out to 48 hours, daily for 8 days, plus official severe-weather alerts
- One-call efficiency: a single HTTP request hydrates everything the panel needs, so the polling rate stays well within the free tier
- A coordinate lookup endpoint so users never need to copy / paste lat / lon by hand
- Drop-in compatibility with the weather tiles and data sources — pick this plugin per-location for a power-user setup, leave others on the simpler current-weather plugin

## Capabilities

- **Current conditions** — full set including UV index, dew point and visibility
- **Hourly forecast** — next 48 hours with temperature, precipitation probability and condition
- **Daily forecast** — next 8 days with high / low, condition, sunrise / sunset and precipitation
- **Weather alerts** — government / national-service severe-weather alerts (when available)
- **Geolocation lookup** — name-based search returns coordinates ready to feed back into a location create call
- **Configurable unit** — Celsius or Fahrenheit per deployment

## Setup

1. Create an account at [OpenWeatherMap](https://openweathermap.org)
2. Subscribe to **One Call API 3.0** (free tier: 1 000 calls/day)
3. Enter the API key in this plugin's configuration
4. Add a weather location (use the geolocation endpoint to look up coordinates) and set its provider to \`${WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME}\`

## API Endpoints

- \`GET /api/v1/plugins/weather-openweathermap-onecall/geolocation?query=…\` — search coordinates by city name

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`api_key\` | OpenWeatherMap API key (required) | — |
| \`unit\` | Temperature unit (\`celsius\` or \`fahrenheit\`) | \`celsius\` |`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
