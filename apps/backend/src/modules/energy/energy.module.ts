import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../common/logger/extension-logger.service';
import { ConfigModule } from '../config/config.module';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ChannelEntity } from '../devices/entities/devices.entity';
import { ExtensionsModule } from '../extensions/extensions.module';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';

import { EnergyHomeController } from './controllers/energy-home.controller';
import { EnergySpacesController } from './controllers/energy-spaces.controller';
import { EnergyController } from './controllers/energy.controller';
import { UpdateEnergyConfigDto } from './dto/update-config.dto';
import { ENERGY_MODULE_API_TAG_DESCRIPTION, ENERGY_MODULE_API_TAG_NAME, ENERGY_MODULE_NAME } from './energy.constants';
import { ENERGY_SWAGGER_EXTRA_MODELS } from './energy.openapi';
import { EnergyDeltaEntity } from './entities/energy-delta.entity';
import { EnergyIngestionListener } from './listeners/energy-ingestion.listener';
import { EnergyConfigModel } from './models/config.model';
import { DeltaComputationService } from './services/delta-computation.service';
import { EnergyCacheService } from './services/energy-cache.service';
import { EnergyCleanupService } from './services/energy-cleanup.service';
import { EnergyDataService } from './services/energy-data.service';
import { EnergyMetricsService } from './services/energy-metrics.service';
import { EnergyModuleResetService } from './services/module-reset.service';

@ApiTag({
	tagName: ENERGY_MODULE_NAME,
	displayName: ENERGY_MODULE_API_TAG_NAME,
	description: ENERGY_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([EnergyDeltaEntity, ChannelEntity]),
		SwaggerModule,
		ConfigModule,
		ExtensionsModule,
	],
	providers: [
		EnergyMetricsService,
		DeltaComputationService,
		EnergyDataService,
		EnergyCacheService,
		EnergyIngestionListener,
		EnergyCleanupService,
		EnergyModuleResetService,
	],
	controllers: [EnergyController, EnergySpacesController, EnergyHomeController],
	exports: [EnergyDataService],
})
export class EnergyModule implements OnModuleInit {
	private readonly logger = createExtensionLogger(ENERGY_MODULE_NAME, 'EnergyModule');

	constructor(
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly moduleReset: EnergyModuleResetService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
	) {}

	onModuleInit(): void {
		// Register factory reset handler
		this.factoryResetRegistry.register(
			ENERGY_MODULE_NAME,
			async (): Promise<{ success: boolean; reason?: string }> => {
				return this.moduleReset.reset();
			},
			180,
		);

		this.modulesMapperService.registerMapping<EnergyConfigModel, UpdateEnergyConfigDto>({
			type: ENERGY_MODULE_NAME,
			class: EnergyConfigModel,
			configDto: UpdateEnergyConfigDto,
		});

		for (const model of ENERGY_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerModuleMetadata({
			type: ENERGY_MODULE_NAME,
			name: 'Energy',
			description: 'Energy consumption and production monitoring with per-space tracking and historical analysis',
			author: 'FastyBird',
			readme: `# Energy

> Module · by FastyBird

Tracks electrical energy consumption and production across the home. Ingests cumulative kWh readings from any device channel that exposes them, normalises the data into fixed 5-minute buckets and surfaces both per-space breakdowns and a home-wide aggregate.

## What it gives you

- A single source of truth for "how much energy did the house use this week" — independent of how many meters, inverters or smart plugs are involved
- Per-space accounting so you can see which room is the loudest consumer
- A simple data model the dashboard energy tile and the assistant can both query without dealing with raw counter values

## Features

- **Per-space tracking** — energy usage broken down by individual spaces, with multiple sources per space
- **Home overview** — aggregated consumption, production, grid import and grid export at home level
- **Delta computation** — cumulative kWh meter readings are turned into 5-minute deltas in the background; counter resets and missing samples are detected and skipped
- **Historical ranges** — pre-aggregated answers for today, yesterday, this week, this month and any custom range
- **Cached aggregates** — frequently requested ranges are cached so dashboard tiles render instantly even on big histories
- **Retention** — old raw records are pruned according to the configured policy; aggregated buckets are kept much longer
- **Multi-source per space** — a space can mix several sources (e.g. a circuit meter + a solar inverter) and the module deduplicates and signs them correctly

## Source Types

| Type | Description |
|------|-------------|
| \`consumption\` | Energy imported from a meter or measured at a load |
| \`production\` | Energy produced (e.g. solar inverter output) |
| \`grid_import\` | Energy drawn from the utility grid |
| \`grid_export\` | Energy fed back to the utility grid |

## API Endpoints

- \`GET /api/v1/modules/energy/status\` — current energy status and configuration
- \`GET /api/v1/modules/energy/home\` — aggregated home energy data
- \`GET /api/v1/modules/energy/spaces/:id\` — per-space energy breakdown
- \`GET /api/v1/modules/energy/spaces/:id/sources\` — list / configure per-space sources`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

		this.logger.log('Energy module initialized');
	}
}
