import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { DashboardModule } from '../../modules/dashboard/dashboard.module';
import { CreateDataSourceDto } from '../../modules/dashboard/dto/create-data-source.dto';
import { UpdateDataSourceDto } from '../../modules/dashboard/dto/update-data-source.dto';
import { DataSourceEntity } from '../../modules/dashboard/entities/dashboard.entity';
import { DataSourceRelationsLoaderRegistryService } from '../../modules/dashboard/services/data-source-relations-loader-registry.service';
import { DataSourcesTypeMapperService } from '../../modules/dashboard/services/data-source-type-mapper.service';
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';
import { WeatherModule } from '../../modules/weather/weather.module';

import {
	DATA_SOURCES_WEATHER_CURRENT_TYPE,
	DATA_SOURCES_WEATHER_FORECAST_DAY_TYPE,
	DATA_SOURCES_WEATHER_PLUGIN_NAME,
} from './data-sources-weather.constants';
import { DATA_SOURCES_WEATHER_PLUGIN_SWAGGER_EXTRA_MODELS } from './data-sources-weather.openapi';
import { CreateCurrentWeatherDataSourceDto, CreateForecastDayDataSourceDto } from './dto/create-data-source.dto';
import { UpdateWeatherDataSourceConfigDto } from './dto/update-config.dto';
import { UpdateCurrentWeatherDataSourceDto, UpdateForecastDayDataSourceDto } from './dto/update-data-source.dto';
import { CurrentWeatherDataSourceEntity, ForecastDayDataSourceEntity } from './entities/data-sources-weather.entity';
import { WeatherDataSourceConfigModel } from './models/config.model';
import { WeatherDataSourceRelationsLoaderService } from './services/data-source-relations-loader.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([CurrentWeatherDataSourceEntity, ForecastDayDataSourceEntity]),
		DashboardModule,
		WeatherModule,
		ConfigModule,
		SwaggerModule,
		ExtensionsModule,
	],
	providers: [WeatherDataSourceRelationsLoaderService],
})
export class DataSourcesWeatherPlugin {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly dataSourcesMapper: DataSourcesTypeMapperService,
		private readonly dataSourceRelationsLoaderRegistryService: DataSourceRelationsLoaderRegistryService,
		private readonly dataSourceRelationsLoaderService: WeatherDataSourceRelationsLoaderService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		// Register plugin configuration
		this.configMapper.registerMapping<WeatherDataSourceConfigModel, UpdateWeatherDataSourceConfigDto>({
			type: DATA_SOURCES_WEATHER_PLUGIN_NAME,
			class: WeatherDataSourceConfigModel,
			configDto: UpdateWeatherDataSourceConfigDto,
		});

		// Register current weather data source type
		this.dataSourcesMapper.registerMapping<
			CurrentWeatherDataSourceEntity,
			CreateCurrentWeatherDataSourceDto,
			UpdateCurrentWeatherDataSourceDto
		>({
			type: DATA_SOURCES_WEATHER_CURRENT_TYPE,
			class: CurrentWeatherDataSourceEntity,
			createDto: CreateCurrentWeatherDataSourceDto,
			updateDto: UpdateCurrentWeatherDataSourceDto,
		});

		// Register forecast day data source type
		this.dataSourcesMapper.registerMapping<
			ForecastDayDataSourceEntity,
			CreateForecastDayDataSourceDto,
			UpdateForecastDayDataSourceDto
		>({
			type: DATA_SOURCES_WEATHER_FORECAST_DAY_TYPE,
			class: ForecastDayDataSourceEntity,
			createDto: CreateForecastDayDataSourceDto,
			updateDto: UpdateForecastDayDataSourceDto,
		});

		// Register relations loader
		this.dataSourceRelationsLoaderRegistryService.register(this.dataSourceRelationsLoaderService);

		// Register swagger models
		for (const model of DATA_SOURCES_WEATHER_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register discriminators for current weather data source
		this.discriminatorRegistry.register({
			parentClass: DataSourceEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DATA_SOURCES_WEATHER_CURRENT_TYPE,
			modelClass: CurrentWeatherDataSourceEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateDataSourceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DATA_SOURCES_WEATHER_CURRENT_TYPE,
			modelClass: CreateCurrentWeatherDataSourceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateDataSourceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DATA_SOURCES_WEATHER_CURRENT_TYPE,
			modelClass: UpdateCurrentWeatherDataSourceDto,
		});

		// Register discriminators for forecast day data source
		this.discriminatorRegistry.register({
			parentClass: DataSourceEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DATA_SOURCES_WEATHER_FORECAST_DAY_TYPE,
			modelClass: ForecastDayDataSourceEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateDataSourceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DATA_SOURCES_WEATHER_FORECAST_DAY_TYPE,
			modelClass: CreateForecastDayDataSourceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateDataSourceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DATA_SOURCES_WEATHER_FORECAST_DAY_TYPE,
			modelClass: UpdateForecastDayDataSourceDto,
		});

		this.extensionsService.registerPluginMetadata({
			type: DATA_SOURCES_WEATHER_PLUGIN_NAME,
			name: 'Weather Data Source',
			description: 'Data sources for connecting tiles to weather information',
			author: 'FastyBird',
			readme: `# Weather Data Source

> Plugin · by FastyBird · platform: dashboard data sources

Data sources that bind dashboard tiles to weather information served by the Weather module — the bridge between the module's normalised location data and the weather tiles drawn on the panel.

## What you get

- Drop-in weather data for any tile that wants it, without any tile needing direct knowledge of the Weather module's API
- Two sharply-defined shapes: "current conditions for this location" and "forecast for this location, N days from today"
- Provider-agnostic: the data source picks the location, not the provider, so you can swap providers without recreating the data source
- The same real-time push the rest of the panel benefits from — the tile updates as soon as the weather module receives a fresh observation

## Data Source Types

- **Current weather** — temperature, condition code & label, humidity, wind speed / direction, pressure, last update time, sunrise / sunset
- **Forecast day** — high / low temperature, condition, precipitation probability for a given day offset (\`0\` = today, \`1\` = tomorrow, …)

## Behaviour

- **Live updates** — re-emits whenever the weather module receives a new observation
- **Unit-aware** — values are emitted in the location's configured units (°C / °F, m·s⁻¹ / mph, …)
- **Graceful empty state** — when the location has not yet received its first observation the data source emits a clearly-marked empty value rather than zeros

## Requirements

The Weather module must be configured with at least one location and an enabled weather provider plugin (e.g. OpenWeatherMap). Each data source selects its weather location (and day offset for forecasts) when it is created.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
