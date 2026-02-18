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
	) {}

	onModuleInit(): void {
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
			readme: `# Energy Module

The Energy module tracks energy consumption and production data for the Smart Panel display.

## Features

- **Per-Space Tracking** - Monitor energy usage broken down by individual spaces
- **Home Overview** - Aggregated energy data across all spaces
- **Historical Analysis** - Query energy data by range (today, yesterday, week, month)
- **Delta Computation** - Automatic interval-based delta bucketing from cumulative kWh readings
- **Source Types** - Track consumption import, generation production, grid import, and grid export

## Endpoints

- \`GET /api/v1/modules/energy/status\` - Current energy status and configuration
- \`GET /api/v1/modules/energy/home\` - Aggregated home energy data
- \`GET /api/v1/modules/energy/spaces/:id\` - Per-space energy breakdown

## Architecture

The module ingests cumulative kWh meter readings from device channels and computes
fixed-interval deltas (5-minute buckets). Results are cached for fast retrieval
and old records are automatically cleaned up based on configurable retention policy.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

		this.logger.log('Energy module initialized');
	}
}
