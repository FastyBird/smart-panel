import { Module } from '@nestjs/common';

import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';

import { PrometheusController } from './controllers/prometheus.controller';
import { StatsController } from './controllers/stats.controller';
import { StatsAggregatorService } from './services/stats-aggregator.service';
import { StatsRegistryService } from './services/stats-registry.service';
import { PrometheusExporterService } from './services/stats.prometheus.service';
import { STATS_MODULE_API_TAG_DESCRIPTION, STATS_MODULE_API_TAG_NAME, STATS_MODULE_NAME } from './stats.constants';
import { STATS_SWAGGER_EXTRA_MODELS } from './stats.openapi';

@ApiTag({
	tagName: STATS_MODULE_NAME,
	displayName: STATS_MODULE_API_TAG_NAME,
	description: STATS_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	providers: [StatsAggregatorService, StatsRegistryService, PrometheusExporterService],
	controllers: [StatsController, PrometheusController],
	exports: [StatsRegistryService],
})
export class StatsModule {
	constructor(private readonly swaggerRegistry: SwaggerModelsRegistryService) {
		for (const model of STATS_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}
	}
}
