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

import { OpenMeteoGeolocationController } from './controllers/geolocation.controller';
import { CreateOpenMeteoLocationDto } from './dto/create-location.dto';
import { UpdateOpenMeteoConfigDto } from './dto/update-config.dto';
import { UpdateOpenMeteoLocationDto } from './dto/update-location.dto';
import { OpenMeteoLocationEntity } from './entities/locations-open-meteo.entity';
import { OpenMeteoConfigModel } from './models/config.model';
import { OpenMeteoProvider } from './platforms/open-meteo.provider';
import { OpenMeteoGeolocationService } from './services/open-meteo-geolocation.service';
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
	controllers: [OpenMeteoGeolocationController],
	providers: [OpenMeteoHttpService, OpenMeteoGeolocationService, OpenMeteoProvider],
	exports: [OpenMeteoHttpService, OpenMeteoGeolocationService, OpenMeteoProvider],
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
			readme: `# Open-Meteo

> Plugin · by FastyBird · platform: weather

Free, no-registration weather provider backed by the [Open-Meteo](https://open-meteo.com) API. Aggregates data from ECMWF, NOAA / GFS, DWD and other national weather services. Current conditions plus a 7-day daily forecast — weather alerts are not exposed by this provider.

## What you get

- Real meteorological data with no API key, no account, no rate limit anxiety
- An ensemble of national weather services under the hood, so accuracy is generally on par with paid providers in covered regions
- A coordinate-based geolocation helper so users can pick a location by city name in the admin UI without copying lat / lon themselves
- A safe default: enabling this plugin and adding a location is all you need to power the weather tiles

## Capabilities

- **Current conditions** — temperature with "feels like", humidity, pressure, wind speed / direction / gusts, cloud cover, precipitation
- **Daily forecast** — 7 days with high / low temperature, condition, precipitation probability, sunrise / sunset
- **Geolocation lookup** — name-based search returns coordinates ready to feed back into a location create call
- **Configurable units** — Celsius or Fahrenheit per deployment

## Setup

1. Enable the plugin (no account or API key required)
2. Add a weather location — use the geolocation endpoint to look up coordinates
3. Set the location's provider to \`${WEATHER_OPEN_METEO_PLUGIN_NAME}\`

## API Endpoints

- \`GET /api/v1/plugins/weather-open-meteo/geolocation?query=…\` — search coordinates by city name

## Data Provided

Current conditions with "feels like" temperature, 7-day daily forecast, wind speed/direction/gusts, cloud coverage, precipitation (rain and snow), sunrise / sunset, atmospheric pressure and humidity.

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`unit\` | Temperature unit (\`celsius\` or \`fahrenheit\`) | \`celsius\` |

## Usage Limits

Free for non-commercial use, up to 10 000 API calls per day.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
