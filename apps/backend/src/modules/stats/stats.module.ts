import { Module } from '@nestjs/common';

import { PrometheusController } from './controllers/prometheus.controller';
import { StatsController } from './controllers/stats.controller';
import { StatsAggregatorService } from './services/stats-aggregator.service';
import { StatsRegistryService } from './services/stats-registry.service';
import { PrometheusExporterService } from './services/stats.prometheus.service';

@Module({
	providers: [StatsAggregatorService, StatsRegistryService, PrometheusExporterService],
	controllers: [StatsController, PrometheusController],
	exports: [StatsRegistryService],
})
export class StatsModule {}
