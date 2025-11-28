import { Module } from '@nestjs/common';
import { ApiExtraModels } from '@nestjs/swagger';

import { ApiTag } from '../api/decorators/api-tag.decorator';

import { PrometheusController } from './controllers/prometheus.controller';
import { StatsController } from './controllers/stats.controller';
import {
	StatResponseModel,
	StatsKeysResponseModel,
	StatsResponseModel,
} from './models/stats-response.model';
import { StatsAggregatorService } from './services/stats-aggregator.service';
import { StatsRegistryService } from './services/stats-registry.service';
import { PrometheusExporterService } from './services/stats.prometheus.service';
import { STATS_MODULE_API_TAG_DESCRIPTION, STATS_MODULE_API_TAG_NAME, STATS_MODULE_NAME } from './stats.constants';

@ApiTag({
	tagName: STATS_MODULE_NAME,
	displayName: STATS_MODULE_API_TAG_NAME,
	description: STATS_MODULE_API_TAG_DESCRIPTION,
})
@ApiExtraModels(StatsResponseModel, StatResponseModel, StatsKeysResponseModel)
@Module({
	providers: [StatsAggregatorService, StatsRegistryService, PrometheusExporterService],
	controllers: [StatsController, PrometheusController],
	exports: [StatsRegistryService],
})
export class StatsModule {}
