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
			readme: `# Weather Tiles

> Plugin · by FastyBird · platform: dashboard tiles

Dashboard tiles that surface data from the Weather module — turn a configured location into an at-a-glance card on any page.

## What you get

- Glanceable, real-time weather without writing any code or hitting any provider API yourself
- A pluggable look-and-feel: the same data behind a compact "now" tile or an expanded multi-day forecast
- Automatic units — the panel honours the unit chosen on the underlying weather location, so °C / °F / m·s⁻¹ / mph all behave correctly

## Tile Types

- **Day weather** — current temperature, condition icon, location label, feels-like, humidity and wind
- **Forecast** — multi-day high / low temperatures, condition icons, precipitation probability and short condition labels

## Behaviour

- **Live updates** — the tile re-renders as soon as the weather module pushes a new observation, so values are never more than one polling cycle stale
- **Provider-agnostic** — works with any weather provider plugin you have installed
- **Sensible defaults** — when a value isn't available from the chosen provider (e.g. UV index on Open-Meteo's current endpoint) the tile gracefully omits it rather than showing zero

## Requirements

The Weather module must be configured with at least one location and a weather provider plugin (e.g. OpenWeatherMap). Each tile is configured individually when placed on a dashboard.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
