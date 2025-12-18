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
			name: 'Weather Data Sources',
			description: 'Data sources for connecting tiles to weather information',
			author: 'FastyBird',
			readme: `# Weather Data Sources Plugin

Data source types for connecting dashboard tiles to weather data.

## Features

- **Current Weather** - Bind to current weather conditions
- **Forecast Data** - Access multi-day weather forecasts
- **Location Selection** - Choose which weather location to display
- **Auto-refresh** - Weather data updates automatically

## Data Source Types

### Current Weather Data Source
Provides:
- Current temperature
- Weather conditions
- Humidity and wind
- Last update time

### Forecast Day Data Source
Provides:
- Daily high/low temperatures
- Weather conditions per day
- Day index selection (0 = today, 1 = tomorrow, etc.)

## Requirements

- Weather module must be configured
- At least one weather location defined
- A weather provider plugin enabled (e.g., OpenWeatherMap)

## Usage

1. Add a weather tile to a dashboard page
2. Create a weather data source
3. Select the location
4. For forecasts, select the day offset
5. The tile displays the weather data`,
			links: {
				documentation: 'https://docs.fastybird.com',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
