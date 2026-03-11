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

import { CreateOpenMeteoLocationDto } from './dto/create-location.dto';
import { UpdateOpenMeteoConfigDto } from './dto/update-config.dto';
import { UpdateOpenMeteoLocationDto } from './dto/update-location.dto';
import { OpenMeteoLocationEntity } from './entities/locations-open-meteo.entity';
import { OpenMeteoConfigModel } from './models/config.model';
import { OpenMeteoProvider } from './platforms/open-meteo.provider';
import { OpenMeteoHttpService } from './services/open-meteo-http.service';
import {
	WEATHER_OPEN_METEO_PLUGIN_API_TAG_DESCRIPTION,
	WEATHER_OPEN_METEO_PLUGIN_API_TAG_NAME,
	WEATHER_OPEN_METEO_PLUGIN_NAME,
	WEATHER_OPEN_METEO_PLUGIN_TYPE,
} from './weather-open-meteo.constants';
import { WEATHER_OPEN_METEO_PLUGIN_SWAGGER_EXTRA_MODELS } from './weather-open-meteo.openapi';

@ApiTag({
	tagName: WEATHER_OPEN_METEO_PLUGIN_NAME,
	displayName: WEATHER_OPEN_METEO_PLUGIN_API_TAG_NAME,
	description: WEATHER_OPEN_METEO_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([OpenMeteoLocationEntity]),
		WeatherModule,
		ConfigModule,
		SwaggerModule,
		ExtensionsModule,
	],
	providers: [OpenMeteoHttpService, OpenMeteoProvider],
	exports: [OpenMeteoHttpService, OpenMeteoProvider],
})
export class WeatherOpenMeteoPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly locationsMapper: LocationsTypeMapperService,
		private readonly providerRegistry: WeatherProviderRegistryService,
		private readonly openMeteoProvider: OpenMeteoProvider,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		// Register plugin configuration
		this.configMapper.registerMapping<OpenMeteoConfigModel, UpdateOpenMeteoConfigDto>({
			type: WEATHER_OPEN_METEO_PLUGIN_NAME,
			class: OpenMeteoConfigModel,
			configDto: UpdateOpenMeteoConfigDto,
		});

		// Register location type mapping
		this.locationsMapper.registerMapping<
			OpenMeteoLocationEntity,
			CreateOpenMeteoLocationDto,
			UpdateOpenMeteoLocationDto
		>({
			type: WEATHER_OPEN_METEO_PLUGIN_TYPE,
			class: OpenMeteoLocationEntity,
			createDto: CreateOpenMeteoLocationDto,
			updateDto: UpdateOpenMeteoLocationDto,
		});

		// Register weather provider
		this.providerRegistry.register(this.openMeteoProvider);

		// Register swagger models
		for (const model of WEATHER_OPEN_METEO_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register discriminators for OpenAPI polymorphism
		this.discriminatorRegistry.register({
			parentClass: WeatherLocationEntity,
			discriminatorProperty: 'type',
			discriminatorValue: WEATHER_OPEN_METEO_PLUGIN_TYPE,
			modelClass: OpenMeteoLocationEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateLocationDto,
			discriminatorProperty: 'type',
			discriminatorValue: WEATHER_OPEN_METEO_PLUGIN_TYPE,
			modelClass: CreateOpenMeteoLocationDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateLocationDto,
			discriminatorProperty: 'type',
			discriminatorValue: WEATHER_OPEN_METEO_PLUGIN_TYPE,
			modelClass: UpdateOpenMeteoLocationDto,
		});

		this.extensionsService.registerPluginMetadata({
			type: WEATHER_OPEN_METEO_PLUGIN_NAME,
			name: 'Open-Meteo',
			description: 'Free weather data provider using Open-Meteo API. No API key required.',
			author: 'FastyBird',
			readme: `# Open-Meteo Weather Provider

Free weather data provider using the Open-Meteo API.

## Features

- **No API Key Required** - Works out of the box with no registration
- **Current Weather** - Real-time temperature, humidity, wind, and conditions
- **7-Day Forecast** - Daily weather predictions
- **Global Coverage** - Weather data for any location worldwide
- **Multiple Weather Models** - Data from ECMWF, GFS, and other national weather services

## Data Provided

- Current conditions with "feels like" temperature
- Daily forecasts for 7 days
- Wind speed, direction, and gusts
- Cloud coverage
- Precipitation (rain and snow)
- Sunrise and sunset times
- Atmospheric pressure and humidity

## Configuration

- **Units** - Temperature units (metric/imperial)

## Notes

- Free for non-commercial use (up to 10,000 API calls/day)
- No registration or API key needed
- Weather alerts are not supported by this provider
- Data sourced from top national weather services (ECMWF, NOAA, DWD, and more)`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
