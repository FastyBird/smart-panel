import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { SeedModule } from '../seed/seeding.module';
import { SeedRegistryService } from '../seed/services/seed-registry.service';
import { StorageModule } from '../storage/storage.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';

import { HistoryController } from './controllers/history.controller';
import { LocationsController } from './controllers/locations.controller';
import { WeatherController } from './controllers/weather.controller';
import { UpdateWeatherConfigDto } from './dto/update-config.dto';
import { WeatherLocationEntity } from './entities/locations.entity';
import { WeatherConfigModel } from './models/config.model';
import { LocationsTypeMapperService } from './services/locations-type-mapper.service';
import { LocationsService } from './services/locations.service';
import { WeatherModuleResetService } from './services/module-reset.service';
import { WeatherHistoryService } from './services/weather-history.service';
import { WeatherProviderRegistryService } from './services/weather-provider-registry.service';
import { WeatherSeederService } from './services/weather-seeder.service';
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
	imports: [TypeOrmModule.forFeature([WeatherLocationEntity]), SwaggerModule, StorageModule, SeedModule],
	controllers: [WeatherController, LocationsController, HistoryController],
	providers: [
		WeatherService,
		LocationsService,
		LocationsTypeMapperService,
		WeatherProviderRegistryService,
		WeatherHistoryService,
		WeatherSeederService,
		WeatherModuleResetService,
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
		private readonly moduleSeeder: WeatherSeederService,
		private readonly moduleReset: WeatherModuleResetService,
		private readonly seedRegistry: SeedRegistryService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
	) {}

	onModuleInit() {
		// Register factory reset handler
		this.factoryResetRegistry.register(
			WEATHER_MODULE_NAME,
			async (): Promise<{ success: boolean; reason?: string }> => {
				return this.moduleReset.reset();
			},
			350,
		);

		// Register seeder (priority 250 - after dashboard)
		this.seedRegistry.register(
			WEATHER_MODULE_NAME,
			async (): Promise<void> => {
				await this.moduleSeeder.seed();
			},
			250,
		);

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
			readme: `# Weather

> Module · by FastyBird

Aggregates weather data for the Smart Panel. Manages a list of named locations, delegates the actual data fetching to provider plugins, normalises the result into a single shape, and pushes updates to the panel and dashboards in real time.

## What it gives you

- One canonical weather model regardless of which provider you use, so tiles, pages and the assistant don't care whether the bytes came from Open-Meteo or OpenWeather
- A long-running scheduler that keeps every location fresh in the background, with automatic retry / back-off on provider errors
- Time-series storage of past observations so dashboards can show trends, not just snapshots

## Features

- **Multiple locations** — keep as many locations as you need (home, weekend cabin, parents' place, …) each with its own provider configuration
- **Provider plugins** — pluggable data sources; pick a provider per location at creation time, swap providers without losing the location's history
- **Background polling** — the module schedules refreshes for every location and re-tries failures with exponential back-off; the panel never has to call the provider directly
- **Forecasts** — current conditions plus a multi-day outlook (resolution depends on the chosen provider)
- **Rich, normalised data** — temperature (current / min / max), humidity, pressure, wind speed and direction, condition code and label, sunrise / sunset, UV index, precipitation
- **Historical data** — every observation is written to the storage module as time-series, exposed through the \`/history\` endpoint
- **Real-time push** — fresh observations are broadcast over WebSocket so panel weather tiles update without polling
- **Validation** — location DTOs are validated by the active provider plugin so an invalid coordinate / city / API key fails fast at the API layer

## API Endpoints

- \`GET|POST|PATCH|DELETE /api/v1/modules/weather/locations\` — manage locations
- \`GET /api/v1/modules/weather/locations/:id\` — current weather for a location
- \`GET /api/v1/modules/weather/locations/:id/history\` — historical observations`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
