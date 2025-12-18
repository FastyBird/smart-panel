import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { DashboardModule } from '../../modules/dashboard/dashboard.module';
import { CreateTileDto } from '../../modules/dashboard/dto/create-tile.dto';
import { UpdateTileDto } from '../../modules/dashboard/dto/update-tile.dto';
import { TileEntity } from '../../modules/dashboard/entities/dashboard.entity';
import { TilesTypeMapperService } from '../../modules/dashboard/services/tiles-type-mapper.service';
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import { CreateDayWeatherTileDto, CreateForecastWeatherTileDto } from './dto/create-tile.dto';
import { WeatherUpdateConfigDto } from './dto/update-config.dto';
import { UpdateDayWeatherTileDto, UpdateForecastWeatherTileDto } from './dto/update-tile.dto';
import { DayWeatherTileEntity, ForecastWeatherTileEntity } from './entities/tiles-weather.entity';
import { WeatherConfigModel } from './models/config.model';
import {
	TILES_WEATHER_DAY_TYPE,
	TILES_WEATHER_FORECAST_TYPE,
	TILES_WEATHER_PLUGIN_NAME,
} from './tiles-weather.constants';
import { TILES_WEATHER_PLUGIN_SWAGGER_EXTRA_MODELS } from './tiles-weather.openapi';

@Module({
	imports: [
		TypeOrmModule.forFeature([DayWeatherTileEntity, ForecastWeatherTileEntity]),
		DashboardModule,
		ConfigModule,
		ExtensionsModule,
		SwaggerModule,
	],
})
export class TilesWeatherPlugin {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly tilesMapper: TilesTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<WeatherConfigModel, WeatherUpdateConfigDto>({
			type: TILES_WEATHER_PLUGIN_NAME,
			class: WeatherConfigModel,
			configDto: WeatherUpdateConfigDto,
		});

		this.tilesMapper.registerMapping<DayWeatherTileEntity, CreateDayWeatherTileDto, UpdateDayWeatherTileDto>({
			type: TILES_WEATHER_DAY_TYPE,
			class: DayWeatherTileEntity,
			createDto: CreateDayWeatherTileDto,
			updateDto: UpdateDayWeatherTileDto,
		});

		this.tilesMapper.registerMapping<
			ForecastWeatherTileEntity,
			CreateForecastWeatherTileDto,
			UpdateForecastWeatherTileDto
		>({
			type: TILES_WEATHER_FORECAST_TYPE,
			class: ForecastWeatherTileEntity,
			createDto: CreateForecastWeatherTileDto,
			updateDto: UpdateForecastWeatherTileDto,
		});

		for (const model of TILES_WEATHER_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.discriminatorRegistry.register({
			parentClass: TileEntity,
			discriminatorProperty: 'type',
			discriminatorValue: TILES_WEATHER_DAY_TYPE,
			modelClass: DayWeatherTileEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateTileDto,
			discriminatorProperty: 'type',
			discriminatorValue: TILES_WEATHER_DAY_TYPE,
			modelClass: CreateDayWeatherTileDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateTileDto,
			discriminatorProperty: 'type',
			discriminatorValue: TILES_WEATHER_DAY_TYPE,
			modelClass: UpdateDayWeatherTileDto,
		});

		this.discriminatorRegistry.register({
			parentClass: TileEntity,
			discriminatorProperty: 'type',
			discriminatorValue: TILES_WEATHER_FORECAST_TYPE,
			modelClass: ForecastWeatherTileEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateTileDto,
			discriminatorProperty: 'type',
			discriminatorValue: TILES_WEATHER_FORECAST_TYPE,
			modelClass: CreateForecastWeatherTileDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateTileDto,
			discriminatorProperty: 'type',
			discriminatorValue: TILES_WEATHER_FORECAST_TYPE,
			modelClass: UpdateForecastWeatherTileDto,
		});

		// Register extension metadata
		this.extensionsService.registerPluginMetadata({
			type: TILES_WEATHER_PLUGIN_NAME,
			name: 'Weather Tiles',
			description: 'Dashboard tiles for displaying current weather and forecasts',
			author: 'FastyBird',
			readme: `# Weather Tiles Plugin

Dashboard tiles for displaying weather information.

## Features

- **Current Weather** - Display current conditions for a location
- **Weather Forecast** - Show multi-day weather forecast
- **Weather Icons** - Visual weather condition indicators
- **Temperature Display** - Current, min, and max temperatures

## Tile Types

### Day Weather Tile
Shows current weather conditions:
- Current temperature
- Weather condition icon
- Location name
- Humidity and wind info

### Forecast Weather Tile
Displays multi-day forecast:
- Daily high/low temperatures
- Weather icons for each day
- Precipitation probability

## Requirements

Requires the Weather module to be configured with at least one location and a weather provider plugin (e.g., OpenWeatherMap).`,
			links: {
				documentation: 'https://docs.fastybird.com',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
